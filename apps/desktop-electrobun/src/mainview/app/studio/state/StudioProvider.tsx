import { createContext, useContext, type PropsWithChildren } from "react";
import { StudioContextUnavailableError } from "../../../../shared/errors";
import type { StudioController } from "../hooks/core/useStudioController";

const StudioContext = createContext<StudioController | null>(null);

export function StudioProvider({
  children,
  value,
}: PropsWithChildren<{ value: StudioController }>) {
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioController {
  const value = useContext(StudioContext);
  if (!value) {
    throw new StudioContextUnavailableError({});
  }
  return value;
}
