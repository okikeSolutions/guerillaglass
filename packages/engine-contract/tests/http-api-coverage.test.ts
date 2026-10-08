import { describe, expect, test } from "vitest";
import { Schema } from "effect";
import * as OpenApi from "effect/http-api/OpenApi";
import * as HttpApi from "effect/http-api/HttpApi";
import { EngineOpenApi } from "../src/openApi";
import { EngineHttpApi } from "../src/httpApi";

type OpenApiOperation = OpenApi.OpenAPISpecOperation;

type ReflectedEndpoint = {
  readonly groupName: string;
  readonly endpointName: string;
  readonly method: string;
  readonly httpApiPath: string;
  readonly openApiPath: string;
  readonly operationId: string;
  readonly params: Schema.Top | undefined;
  readonly query: Schema.Top | undefined;
  readonly payloadSize: number;
  readonly successSize: number;
  readonly errorSize: number;
  readonly schemas: ReadonlyArray<{ readonly role: string; readonly schema: Schema.Top }>;
};

/**
 * Converts Effect router `:param` path syntax to OpenAPI `{param}` path syntax.
 *
 * @param path - Path from a reflected `HttpApiEndpoint`.
 * @returns Equivalent OpenAPI path template.
 */
function toOpenApiPath(path: string) {
  return path.replaceAll(/:([A-Za-z0-9_]+)/g, "{$1}");
}

/**
 * Returns every endpoint declared in {@link EngineHttpApi} with schema metadata.
 *
 * @returns Reflected endpoint entries used by coverage assertions.
 */
function reflectEndpoints(): ReadonlyArray<ReflectedEndpoint> {
  const endpoints: Array<ReflectedEndpoint> = [];
  HttpApi.reflect(EngineHttpApi, {
    onGroup: () => undefined,
    onEndpoint: ({ group, endpoint, successes, errors }) => {
      const payloadSchemas = Array.from(endpoint.payload.values()).flatMap(
        (payload) => payload.schemas,
      );
      const successSchemas = Array.from(successes.values()).flatMap((schemas) => schemas);
      const errorSchemas = Array.from(errors.values()).flatMap((schemas) => schemas);
      endpoints.push({
        groupName: group.identifier,
        endpointName: endpoint.identifier,
        method: endpoint.method.toLowerCase(),
        httpApiPath: endpoint.path,
        openApiPath: toOpenApiPath(endpoint.path),
        operationId: `${group.identifier}.${endpoint.identifier}`,
        params: endpoint.params,
        query: endpoint.query,
        payloadSize: payloadSchemas.length,
        successSize: successSchemas.length,
        errorSize: errorSchemas.length,
        schemas: [
          ...(endpoint.params ? [{ role: "params", schema: endpoint.params }] : []),
          ...(endpoint.query ? [{ role: "query", schema: endpoint.query }] : []),
          ...payloadSchemas.map((schema) => ({ role: "payload", schema })),
          ...successSchemas.map((schema) => ({ role: "success", schema })),
          ...errorSchemas.map((schema) => ({ role: "error", schema })),
        ],
      });
    },
  });
  return endpoints;
}

/**
 * Looks up a generated OpenAPI operation for a reflected endpoint.
 *
 * @param endpoint - Reflected endpoint metadata.
 * @returns The matching OpenAPI operation, if present.
 */
function findOpenApiOperation(endpoint: ReflectedEndpoint): OpenApiOperation | undefined {
  const pathItem = Object.entries(EngineOpenApi.paths).find(
    ([path]) => path === endpoint.openApiPath,
  )?.[1];
  if (!pathItem || !isOpenApiMethod(endpoint.method)) {
    return undefined;
  }
  return pathItem[endpoint.method];
}

function isOpenApiMethod(method: string): method is OpenApi.OpenAPISpecMethodName {
  return ["get", "put", "post", "delete", "options", "head", "patch", "trace"].includes(method);
}

describe("EngineHttpApi endpoint and schema coverage", () => {
  const endpoints = reflectEndpoints();

  test("every reflected endpoint is emitted into OpenAPI", () => {
    expect(endpoints).toHaveLength(28);

    for (const endpoint of endpoints) {
      const operation = findOpenApiOperation(endpoint);
      expect(operation, `${endpoint.method.toUpperCase()} ${endpoint.openApiPath}`).toBeDefined();
      expect(operation?.operationId).toBe(endpoint.operationId);
    }
  });

  test("every endpoint declares success and error schemas", () => {
    for (const endpoint of endpoints) {
      expect(endpoint.successSize, endpoint.operationId).toBeGreaterThan(0);
      expect(endpoint.errorSize, endpoint.operationId).toBeGreaterThan(0);
    }
  });

  test("request body, path params, and query params match reflected endpoint schemas", () => {
    for (const endpoint of endpoints) {
      const operation = findOpenApiOperation(endpoint);
      expect(operation, endpoint.operationId).toBeDefined();

      if (endpoint.payloadSize > 0) {
        expect(operation?.requestBody, endpoint.operationId).toBeDefined();
      } else {
        expect(operation?.requestBody, endpoint.operationId).toBeUndefined();
      }

      if (endpoint.params) {
        expect(
          operation?.parameters?.some((parameter) => parameter.in === "path"),
          endpoint.operationId,
        ).toBe(true);
      }

      if (endpoint.query) {
        expect(
          operation?.parameters?.some((parameter) => parameter.in === "query"),
          endpoint.operationId,
        ).toBe(true);
      }
    }
  });

  test("every endpoint payload, success, error, params, and query schema exports to JSON Schema", () => {
    for (const endpoint of endpoints) {
      for (const entry of endpoint.schemas) {
        expect(
          () => Schema.toJsonSchemaDocument(entry.schema),
          `${endpoint.operationId} ${entry.role}`,
        ).not.toThrow();
      }
    }
  });
});
