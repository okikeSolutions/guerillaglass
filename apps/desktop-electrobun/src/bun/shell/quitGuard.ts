/** Guards every ordinary native quit request before starting scoped cleanup. */
export function makeQuitGuard(options: {
  confirm: () => Promise<boolean>;
  quit: () => Promise<void>;
}) {
  let approved = false;
  let pending: Promise<void> | undefined;
  const request = (): Promise<void> => {
    pending ??= Promise.resolve()
      .then(options.confirm)
      .then(async (allow) => {
        if (!allow) {
          return;
        }
        approved = true;
        await options.quit();
      })
      .finally(() => {
        // Cancelled or failed confirmation can be retried. Approved teardown
        // remains one operation even when native callbacks re-enter it.
        if (!approved) {
          pending = undefined;
        }
      });
    return pending;
  };
  return {
    request,
    get approved() {
      return approved;
    },
    vetoNativeQuit(event: { response?: unknown }): boolean {
      if (approved) {
        return false;
      }
      event.response = { allow: false };
      return true;
    },
  };
}
