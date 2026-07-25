# Engine client

Effect-native client and scoped process launcher for the authenticated local Guerilla Glass engine HTTP API.

## Ownership

- Wire schemas and endpoints: `packages/engine-contract`
- Generated OpenAPI: `packages/engine-contract/generated/engine.openapi.json`
- Native process launch/readiness/authentication: this package
- Agent Mode operational workflow: `docs/AGENT_MODE_RUNBOOK.md`

Do not construct raw HTTP clients in desktop application services. Use `layerEngineClientBun` at a composition root and consume the domain services or `EngineClient` tag.

## Scoped launch example

```ts
import { EngineClient, layerEngineClientBun } from "@guerillaglass/engine-client/service";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const engine = yield* EngineClient;
  const capabilities = yield* engine.engineCapabilities;
  return capabilities;
});

const capabilities = await Effect.runPromise(
  Effect.scoped(
    program.pipe(
      Effect.provide(
        layerEngineClientBun({
          enginePath: "/absolute/path/to/guerillaglass-engine",
        }),
      ),
    ),
  ),
);
```

The scoped layer:

1. generates a redacted per-process bearer token;
2. launches the engine with loopback HTTP transport;
3. parses the readiness envelope;
4. decorates generated `HttpApi` requests with bearer authentication; and
5. terminates the native process when its Effect scope closes.

Before invoking optional behavior, read `engineCapabilities`. Windows/Linux foundation shells intentionally do not advertise production Agent Mode or cut-plan export parity merely because generated endpoints compile.

## Checks

```bash
cd packages/engine-client
bun run typecheck
bun run test
```
