import { createContext, useContext, type PropsWithChildren } from "react";
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
    throw new Error("Studio context is not available");
  }
  return value;
}
