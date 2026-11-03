import { createContext, type ReactNode, useContext, useState } from "react";

export type Selection = { board: string; ids: string[]; labels: string[] };

const Current = createContext<Selection | null>(null);
// Separate from the value, so the board publishing it does not re-render on
// every change.
const Setter = createContext<(s: Selection | null) => void>(() => {});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<Selection | null>(null);
  return (
    <Setter.Provider value={setSelection}>
      <Current.Provider value={selection}>{children}</Current.Provider>
    </Setter.Provider>
  );
}

export const useSelection = (): Selection | null => useContext(Current);

export const useSetSelection = (): ((s: Selection | null) => void) =>
  useContext(Setter);

type Labelled = {
  id: string;
  type: string;
  text?: string;
  containerId?: string | null;
  isDeleted?: boolean;
};

// What a person would call each selected element: the text bound to a shape,
// the text itself, or else the element type.
export function selectionLabels(
  elements: readonly Labelled[],
  ids: string[],
): string[] {
  const live = elements.filter((e) => !e.isDeleted);
  const byId = new Map(live.map((e) => [e.id, e]));
  const bound = new Map(
    live.flatMap((e) => (e.containerId ? [[e.containerId, e.text]] : [])),
  );
  return ids.map((id) => {
    const label = bound.get(id) || byId.get(id)?.text;
    return label?.replace(/\s+/g, " ").trim() || byId.get(id)?.type || id;
  });
}
