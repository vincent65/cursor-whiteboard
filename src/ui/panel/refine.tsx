import { createContext, type ReactNode, useContext, useState } from "react";

export type RefineTarget = { id: string; title: string | null };

const Current = createContext<RefineTarget | null>(null);
// Separate from the value, like the selection, so a stable setter can be
// handed around without tracking the target.
const Setter = createContext<(t: RefineTarget | null) => void>(() => {});

export function RefineProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<RefineTarget | null>(null);
  return (
    <Setter.Provider value={setTarget}>
      <Current.Provider value={target}>{children}</Current.Provider>
    </Setter.Provider>
  );
}

export const useRefine = (): {
  target: RefineTarget | null;
  setTarget(t: RefineTarget | null): void;
} => ({ target: useContext(Current), setTarget: useContext(Setter) });
