import {
  Bot,
  FileText,
  ListChecks,
  type LucideIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  ScrollText,
  Shapes,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { slugify } from "../../shared/slug";
import type { Route } from "../hooks/useHashRoute";
import { Pip } from "../Pip";

type Kind = "board" | "doc";

const ICON = { board: Shapes, doc: FileText } as const;
// What the interface calls each kind; routes and files keep the short "doc".
const NOUN = { board: "board", doc: "document" } as const;
const PLAN: [kind: "spec" | "tasks" | "sessions", label: string, LucideIcon][] =
  [
    ["spec", "Spec", ScrollText],
    ["tasks", "Tasks", ListChecks],
    ["sessions", "Sessions", Bot],
  ];

// The name field a New board or New document opens at the top of its list:
// Enter creates, Escape or leaving it empty cancels. A name already taken, or a
// create the server refuses, says why under the field and keeps it open.
function CreateRow({
  kind,
  names,
  onCreate,
  onCancel,
}: {
  kind: Kind;
  names: string[];
  onCreate(name: string): Promise<void> | void;
  onCancel(): void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const Icon = ICON[kind];

  const commit = async () => {
    if (!text.trim()) return onCancel();
    const name = slugify(text);
    if (!name) {
      setError("Use at least one letter or digit.");
      return;
    }
    if (names.includes(name)) {
      setError(`There is already a ${NOUN[kind]} named ${name}.`);
      return;
    }
    try {
      await onCreate(name);
    } catch (err) {
      setError((err as Error).message);
    }
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <li className="nav-create-row">
      <div className="nav-link nav-input-wrap">
        <Icon className="nav-icon" size={16} aria-hidden="true" />
        <input
          ref={input}
          className="nav-input"
          aria-label={`New ${NOUN[kind]} name`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `new-${kind}-error` : undefined}
          placeholder={kind === "board" ? "Board name" : "Document name"}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => !text.trim() && onCancel()}
        />
      </div>
      {error && (
        <p id={`new-${kind}-error`} role="alert" className="nav-error">
          {error}
        </p>
      )}
    </li>
  );
}

function NavSection(props: {
  title: string;
  kind: Kind;
  names: string[];
  active: Route;
  creating: boolean;
  onCreatingChange(creating: boolean): void;
  onCreate(name: string): Promise<void> | void;
  onNavigate?(): void;
}) {
  const {
    title,
    kind,
    names,
    active,
    creating,
    onCreatingChange,
    onCreate,
    onNavigate,
  } = props;
  const Icon = ICON[kind];
  return (
    <section className="nav-section">
      <div className="nav-head">
        <h2 className="nav-title">{title}</h2>
        <button
          type="button"
          className="icon-button nav-add"
          aria-label={`New ${NOUN[kind]}`}
          title={`New ${NOUN[kind]}`}
          onClick={() => onCreatingChange(true)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <ul className="nav-list">
        {creating && (
          <CreateRow
            kind={kind}
            names={names}
            onCreate={async (name) => {
              await onCreate(name);
              onCreatingChange(false);
            }}
            onCancel={() => onCreatingChange(false)}
          />
        )}
        {names.map((name) => (
          <li key={name}>
            <a
              className="nav-link"
              onClick={onNavigate}
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
              <Icon className="nav-icon" size={16} aria-hidden="true" />
              <span className="nav-label">{name}</span>
            </a>
          </li>
        ))}
        {names.length === 0 && !creating && (
          <li className="nav-none">No {NOUN[kind]}s yet</li>
        )}
      </ul>
    </section>
  );
}

export function Sidebar({
  boards,
  docs,
  active,
  onCreateBoard,
  onCreateDoc,
  creating = null,
  onCreatingChange,
  collapsed = false,
  onCollapsedChange,
  floating = false,
  onNavigate,
}: {
  boards: string[];
  docs: string[];
  active: Route;
  // A rejection keeps the name field open with the error under it.
  onCreateBoard(name: string): Promise<void> | void;
  onCreateDoc(name: string): Promise<void> | void;
  // The list whose name field is open; owned by the caller so a page can open it.
  creating?: Kind | null;
  onCreatingChange?(kind: Kind | null): void;
  collapsed?: boolean;
  onCollapsedChange?(collapsed: boolean): void;
  // Open over the board in a narrow window: Escape folds it again.
  floating?: boolean;
  // A page link was followed, including one to the page already open.
  onNavigate?(): void;
}) {
  // Uncontrolled when the caller does not own the name field.
  const [ownCreating, setOwnCreating] = useState<Kind | null>(null);
  const open = onCreatingChange ? creating : ownCreating;
  const setOpen = onCreatingChange ?? setOwnCreating;

  // Folding or unfolding by hand moves focus to the button that took the
  // pressed one's place.
  const expand = useRef<HTMLButtonElement>(null);
  const collapse = useRef<HTMLButtonElement>(null);
  const toggled = useRef(false);
  const setCollapsed = (next: boolean) => {
    toggled.current = true;
    onCollapsedChange?.(next);
  };
  useEffect(() => {
    if (!toggled.current) return;
    toggled.current = false;
    (collapsed ? expand : collapse).current?.focus();
  }, [collapsed]);

  if (collapsed)
    return (
      <nav className="sidebar sidebar-collapsed" aria-label="Plan files">
        <button
          type="button"
          className="icon-button"
          ref={expand}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          onClick={() => setCollapsed(false)}
        >
          <PanelLeftOpen size={18} aria-hidden="true" />
        </button>
        <span className="rail-rule" />
        {PLAN.map(([kind, label, Icon]) => (
          <a
            key={kind}
            className="icon-button"
            href={`#/${kind}`}
            aria-label={label}
            title={label}
            aria-current={active?.kind === kind ? "page" : undefined}
          >
            <Icon size={18} aria-hidden="true" />
          </a>
        ))}
        <span className="rail-rule" />
        {(["board", "doc"] as const).map((kind) => {
          const Icon = ICON[kind];
          const label = kind === "board" ? "Boards" : "Documents";
          return (
            <button
              key={kind}
              type="button"
              className="icon-button"
              aria-label={label}
              title={label}
              aria-current={active?.kind === kind ? "page" : undefined}
              onClick={() => setCollapsed(false)}
            >
              <Icon size={18} aria-hidden="true" />
            </button>
          );
        })}
      </nav>
    );

  return (
    <nav
      className="sidebar"
      aria-label="Plan files"
      onKeyDown={(e) => {
        if (floating && e.key === "Escape") setCollapsed(true);
      }}
    >
      <div className="brand">
        <Pip size={18} />
        <span className="brand-name">Blueprint</span>
        {onCollapsedChange && (
          <button
            type="button"
            className="icon-button"
            ref={collapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            onClick={() => setCollapsed(true)}
          >
            <PanelLeftClose size={16} aria-hidden="true" />
          </button>
        )}
      </div>
      <section className="nav-section">
        <h2 className="nav-title">Plan</h2>
        <ul className="nav-list">
          {PLAN.map(([kind, label, Icon]) => (
            <li key={kind}>
              <a
                className="nav-link"
                onClick={onNavigate}
                href={`#/${kind}`}
                aria-current={active?.kind === kind ? "page" : undefined}
              >
                <Icon className="nav-icon" size={16} aria-hidden="true" />
                <span className="nav-label">{label}</span>
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
        creating={open === "board"}
        onCreatingChange={(on) => setOpen(on ? "board" : null)}
        onCreate={onCreateBoard}
        onNavigate={onNavigate}
      />
      <NavSection
        title="Documents"
        kind="doc"
        names={docs}
        active={active}
        creating={open === "doc"}
        onCreatingChange={(on) => setOpen(on ? "doc" : null)}
        onCreate={onCreateDoc}
        onNavigate={onNavigate}
      />
    </nav>
  );
}
