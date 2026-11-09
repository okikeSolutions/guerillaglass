/** One host quit lifecycle shared by menu and native-window callbacks.
 * Cleanup starts outside the managed runtime it disposes, so it can interrupt
 * pending bridge fibers and their scoped native-dialog child processes.
 */
export function makeGracefulQuit(
  dispose: () => Promise<void>,
  quit: () => void,
): () => Promise<void> {
  let pending: Promise<void> | undefined;
  return () => {
    pending ??= Promise.resolve().then(dispose).finally(quit);
    return pending;
  };
}
