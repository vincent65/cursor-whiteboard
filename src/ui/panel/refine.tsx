import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useState,
} from "react";

export type RefineTarget = { id: string; title: string | null };

const Current = createContext<RefineTarget | null>(null);
// Separate from the value, like the selection, so a stable setter can be
// handed around without tracking the target.
// It takes an updater too, so a late clear can check it still names its target.
const Setter = createContext<Dispatch<SetStateAction<RefineTarget | null>>>(
  () => {},
);

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
  setTarget: Dispatch<SetStateAction<RefineTarget | null>>;
} => ({ target: useContext(Current), setTarget: useContext(Setter) });
