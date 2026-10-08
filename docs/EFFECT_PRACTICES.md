# Effect practices

Read this when changing TypeScript services, schemas, configuration, polling, SDK adapters, or Effect tests. Use the `$effect` skill with the installed Effect source. Runtime packages and the vendor source must have the same version, which `bun run repo:check` verifies.

## Implementation order

1. Define domain records with `Schema.Struct` and a matching interface. Keep existing schema exports when callers or generators depend on their names. Preserve encoded field names, optional-key behavior, brands, and persisted defaults.
2. Decode unknown input at the boundary. Effect workflows use `Schema.decodeUnknownEffect`. Pure renderer parsing uses Result or Option decoders according to whether callers need mismatch details. Synchronous compatibility helpers translate Result failures into the established tagged errors.
3. Implement service methods with named `Effect.fn` functions. Keep the success, failure, and required-service types visible. Existing Effect-valued service members remain reusable operations. Factories and layer constructors are separate from those operations.
4. Acquire dependencies in `Layer.effect(Service, Effect.gen(...))`, then return `Service.of(...)`. A stateless, synchronous adapter factory can use `Layer.sync`. Compose shared dependencies at the application root so acquisition and finalization happen once.
5. Model expected failures with `Schema.TaggedError`. Map SDK exceptions at their adapter boundary. Use typed recovery for an actual fallback. Let defects and interruption reach supervision. `schema.makeEffect` failures are `SchemaIssue.Issue`; wrap them in `Schema.SchemaError` when that is the boundary's declared failure.
6. Read application settings through `Config`. Optional hosted review configuration can degrade to an unavailable review service. Local engine trust and filesystem authority retain their own validation.
7. Use `Schedule` for repeated work and `Stream` for multi-value sources. Fork workers and delayed shell work into their owning scope. Tests use `TestClock` for expiry and `Deferred` or `Queue` for background synchronization.

## Boundaries that need judgment

| Boundary                        | Implementation and reason                                                                                                                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native Rust and Swift           | Consume generated OpenAPI bindings. Effect owns the TypeScript contract, while native implementations keep their platform APIs.                                                                                                                             |
| React and Convex                | Preserve framework hooks, transactions, and validators. Effect services own host workflows; DTO schemas own shared wire data. React props, callback interfaces, and SDK resource handles are framework types.                                               |
| SDK integrations                | Wrap promises in named effects, preserve interruption, and decode successful remote responses. The review gateway validates Convex responses against review-protocol schemas.                                                                               |
| Browser bridge                  | Promise calls cross the host boundary; schema-only validation in the renderer uses Result decoders and preserves tagged validation errors without starting a runtime per call. Host workflows use Effect services.                                            |
| No-follow file IO               | `NoFollowFileIO` is the only Node filesystem adapter allowed in application source. Effect's `FileSystem.open` accepts string flags, so the adapter retains `O_NOFOLLOW` and `O_EXCL`. Policy, canonical paths, and directory creation use Effect services. |
| Capability and media tokens     | These registries are authorization state. A missing token must stay missing. Single-use grants, directory grants, and absolute versus idle expiry cannot use a cache loader that reconstructs authority on a miss.                                          |
| Latest preview frame            | The registry retains the last delivered frame for the explicit no-new-frame fallback. This is token-owned state, rather than a per-key lookup cache. Use `Cache` for new lookup memoization when its lifecycle fits.                                        |
| Better Auth provider            | The documented compatibility cast addresses the upstream provider's `never` session type. It does not erase an Effect error or service requirement. Remove it when the provider accepts the concrete client type.                                           |
| Process environment inheritance | Launch adapters may copy the parent environment to a child. Read application settings through `Config`; environment forwarding is not configuration lookup.                                                                                                 |
| Benchmark timing                | Measurements use the live monotonic clock. Window polling and telemetry pacing use `Schedule`; renderer readiness uses scoped streams and `Deferred`.                                                                                                       |

## Verification and completion

Select commands through [Verification selection](CHANGE_MAP.md#verification-selection). Run heavy checks sequentially with the documented worker limits.

- `bun run repo:check` checks runtime version alignment, platform imports, and AST rules for Effect casts, non-null assertions, error classes, hidden service defaults, configuration reads, and unfiltered cause recovery.
- Type-aware lint and focused typechecks prove the declared success, failure, and service types. The lint configuration allows an interface with one parent so the skill's schema/interface pattern is valid.
- Boundary tests must exercise malformed input and truthful error mapping. Tests that only dispatch endpoints can use defects to stop after observing the call; they must not advertise fabricated success payloads as generated client responses.
- Contract changes require deterministic generation and both native consumers. DTO naming changes must preserve wire output.
- Desktop runtime changes require packaged acceptance and Peekaboo interaction through the permissioned GUI bridge, as specified in the desktop guide.

Passing the mechanical checks is evidence for those rules. Completion also requires reviewing the changed workflows against the skill and reporting any remaining verification gap.
