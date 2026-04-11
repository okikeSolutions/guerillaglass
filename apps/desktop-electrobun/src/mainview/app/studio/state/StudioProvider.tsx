import { createContext, useContext, useSyncExternalStore, type PropsWithChildren } from "react";
import { StudioContextUnavailableError } from "@shared/errors";
import type { StudioController } from "../hooks/core/useStudioController";
import type {
  PlaybackTransportSnapshot,
  PlaybackTransportStore,
} from "../hooks/timeline/usePlaybackTransport";

const StudioContext = createContext<StudioController | null>(null);
const StudioPlaybackContext = createContext<PlaybackTransportStore | null>(null);

export function StudioProvider({
  children,
  value,
}: PropsWithChildren<{ value: StudioController }>) {
  return (
    <StudioContext.Provider value={value}>
      <StudioPlaybackContext.Provider value={value.playbackStore}>
        {children}
      </StudioPlaybackContext.Provider>
    </StudioContext.Provider>
  );
}

export function useStudio(): StudioController {
  const value = useContext(StudioContext);
  if (!value) {
    throw new StudioContextUnavailableError({});
  }
  return value;
}

export function useStudioPlaybackValue<T>(selector: (snapshot: PlaybackTransportSnapshot) => T): T {
  const store = useContext(StudioPlaybackContext);
  if (!store) {
    throw new StudioContextUnavailableError({});
  }

  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getSnapshot()),
    () => selector(store.getSnapshot()),
  );
}
