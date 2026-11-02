import { slugify } from "../../shared/slug";

type Kind = "board" | "doc";

function NavSection(props: {
  title: string;
  kind: Kind;
  names: string[];
  active: { kind: Kind; name: string } | null;
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
                active?.kind === kind && active.name === name
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
  active: { kind: Kind; name: string } | null;
  onCreateBoard(name: string): void;
  onCreateDoc(name: string): void;
}) {
  return (
    <nav className="sidebar" aria-label="Plan files">
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
