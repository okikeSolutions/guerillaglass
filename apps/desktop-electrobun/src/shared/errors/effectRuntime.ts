import { Cause, Effect, Exit, Option } from "effect";

function throwEffectFailure(cause: Cause.Cause<unknown>): never {
  const failure = Cause.failureOption(cause);
  if (Option.isSome(failure)) {
    throw failure.value;
  }
  throw Cause.squash(cause);
}

export function runEffectSync<A, E>(effect: Effect.Effect<A, E>): A {
  return Exit.match(Effect.runSyncExit(effect), {
    onFailure: throwEffectFailure,
    onSuccess: (value) => value,
  });
}

export async function runEffectPromise<A, E>(effect: Effect.Effect<A, E>): Promise<A> {
  return Exit.match(await Effect.runPromiseExit(effect), {
    onFailure: throwEffectFailure,
    onSuccess: (value) => value,
  });
}
