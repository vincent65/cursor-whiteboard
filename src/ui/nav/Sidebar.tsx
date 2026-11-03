import { slugify } from "../../shared/slug";
import type { Route } from "../hooks/useHashRoute";

type Kind = "board" | "doc";

function NavSection(props: {
  title: string;
  kind: Kind;
  names: string[];
  active: Route;
  onCreate(name: string): void;
}) {
  const { title, kind, names, active, onCreate } = props;
  const create = () => {
    const input = window.prompt(`New ${kind} name`);
    if (!input?.trim()) return;
    const name = slugify(input);
    if (name) onCreate(name);
    else window.alert(`A ${kind} name needs at least one letter or digit.`);
  };
  return (
    <section className="nav-section">
      <h2 className="nav-title">{title}</h2>
      <ul className="nav-list">
        {names.map((name) => (
          <li key={name}>
            <a
              className="nav-link"
              href={`#/${kind}s/${name}`}
              aria-current={
                active &&
                "name" in active &&
                active.kind === kind &&
                active.name === name
                  ? "page"
                  : undefined
              }
            >
              {name}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="nav-create" onClick={create}>
        New {kind}
      </button>
    </section>
  );
}

export function Sidebar({
  boards,
  docs,
  active,
  onCreateBoard,
  onCreateDoc,
}: {
  boards: string[];
  docs: string[];
  active: Route;
  onCreateBoard(name: string): void;
  onCreateDoc(name: string): void;
}) {
  return (
    <nav className="sidebar" aria-label="Plan files">
      <section className="nav-section">
        <h2 className="nav-title">Plan</h2>
        <ul className="nav-list">
          {(
            [
              ["spec", "Spec"],
              ["tasks", "Tasks"],
              ["sessions", "Sessions"],
            ] as const
          ).map(([kind, label]) => (
            <li key={kind}>
              <a
                className="nav-link"
                href={`#/${kind}`}
                aria-current={active?.kind === kind ? "page" : undefined}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
      </section>
      <NavSection
        title="Boards"
        kind="board"
        names={boards}
        active={active}
        onCreate={onCreateBoard}
      />
      <NavSection
        title="Docs"
        kind="doc"
        names={docs}
        active={active}
        onCreate={onCreateDoc}
      />
    </nav>
  );
}
