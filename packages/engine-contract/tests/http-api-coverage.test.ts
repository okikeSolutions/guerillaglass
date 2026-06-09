import { describe, expect, test } from "vitest";
import { Schema } from "effect";
import { EngineOpenApi } from "../src/openApi";
import { EngineHttpApi } from "../src/httpApi";

type OpenApiOperation = {
  readonly operationId?: string;
  readonly parameters?: ReadonlyArray<{ readonly in?: string; readonly name?: string }>;
  readonly requestBody?: unknown;
  readonly responses?: Record<string, unknown>;
};

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
  return Object.entries(EngineHttpApi.groups).flatMap(([groupName, group]) =>
    Object.entries(group.endpoints).map(([endpointName, endpoint]) => {
      const payloadSchemas = Array.from(endpoint.payload.values()).flatMap(
        (payload) => (payload as { readonly schemas: ReadonlyArray<Schema.Top> }).schemas,
      );
      const successSchemas = Array.from(endpoint.success);
      const errorSchemas = Array.from(endpoint.error);

      return {
        groupName,
        endpointName,
        method: endpoint.method.toLowerCase(),
        httpApiPath: endpoint.path,
        openApiPath: toOpenApiPath(endpoint.path),
        operationId: `${groupName}.${endpointName}`,
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
      } satisfies ReflectedEndpoint;
    }),
  );
}

/**
 * Looks up a generated OpenAPI operation for a reflected endpoint.
 *
 * @param endpoint - Reflected endpoint metadata.
 * @returns The matching OpenAPI operation, if present.
 */
function findOpenApiOperation(endpoint: ReflectedEndpoint): OpenApiOperation | undefined {
  const pathItem = EngineOpenApi.paths[endpoint.openApiPath as keyof typeof EngineOpenApi.paths] as
    | Record<string, OpenApiOperation>
    | undefined;
  return pathItem?.[endpoint.method];
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
