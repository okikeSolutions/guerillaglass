import { Cause, Effect, Exit, ManagedRuntime, Option } from "effect";
import {
  makeLayerDesktopApp,
  type DesktopAppLayerOptions,
  type DesktopAppServices,
} from "./AppLayer";

/** Managed runtime handle used by the Electrobun app and bridge execution edges. */
export type DesktopAppRuntime = {
  runPromise: <A, E, R extends DesktopAppServices>(
    effect: Effect.Effect<A, E, R>,
    options?: { readonly signal?: AbortSignal | undefined },
  ) => Promise<A>;
  dispose: () => Promise<void>;
};

function throwManagedRuntimeFailure(cause: Cause.Cause<unknown>): never {
  const failure = Cause.findErrorOption(cause);
  if (Option.isSome(failure)) {
    throw failure.value;
  }
  throw Cause.squash(cause);
}

/** Creates the managed desktop app runtime and eagerly builds its composed layer. */
export async function makeDesktopAppRuntime(
  options: DesktopAppLayerOptions,
): Promise<DesktopAppRuntime> {
  const runtime = ManagedRuntime.make(makeLayerDesktopApp(options));
  await runtime.context();

  return {
    runPromise: async (effect, runOptions) =>
      Exit.match(await runtime.runPromiseExit(effect, runOptions), {
        onFailure: throwManagedRuntimeFailure,
        onSuccess: (value) => value,
      }),
    dispose: async () => runtime.dispose(),
  };
}
