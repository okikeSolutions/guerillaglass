import { useCallback, useEffect, useRef, useState } from "react";

export type ReplacementKind = "project" | "recording";

/** One pending decision owns the dialog. Other callers cancel rather than sharing approval. */
export function useReplacementConfirmation() {
  const [kind, setKind] = useState<ReplacementKind | null>(null);
  const mounted = useRef(true);
  const pending = useRef<((approved: boolean) => void) | null>(null);
  const request = useCallback((next: ReplacementKind): Promise<boolean> => {
    if (!mounted.current || pending.current) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      pending.current = resolve;
      setKind(next);
    });
  }, []);
  const decide = useCallback((approved: boolean) => {
    const resolve = pending.current;
    if (!resolve) {
      return;
    }
    pending.current = null;
    if (mounted.current) {
      setKind(null);
    }
    resolve(approved);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.(false);
      pending.current = null;
    };
  }, []);
  return { kind, request, decide };
}
