import {
  Bot,
  DraftingCompass,
  FileText,
  ListChecks,
  type LucideIcon,
  Plus,
  ScrollText,
  Shapes,
} from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { slugify } from "../../shared/slug";
import type { Route } from "../hooks/useHashRoute";

type Kind = "board" | "doc";

const ICON = { board: Shapes, doc: FileText } as const;
const PLAN: [kind: "spec" | "tasks" | "sessions", label: string, LucideIcon][] =
  [
    ["spec", "Spec", ScrollText],
    ["tasks", "Tasks", ListChecks],
    ["sessions", "Sessions", Bot],
  ];

// The name field a New board or New doc opens at the top of its list: Enter
// creates, Escape or leaving it empty cancels.
function CreateRow({
  kind,
  onCreate,
  onCancel,
}: {
  kind: Kind;
  onCreate(name: string): void;
  onCancel(): void;
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);
  const Icon = ICON[kind];

  const commit = () => {
    if (!text.trim()) return onCancel();
    const name = slugify(text);
    if (!name) {
      setError("Use at least one letter or digit.");
      return;
    }
    onCreate(name);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      commit();
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
          aria-label={`New ${kind} name`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `new-${kind}-error` : undefined}
          placeholder={kind === "board" ? "Board name" : "Doc name"}
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
  onCreate(name: string): void;
}) {
  const { title, kind, names, active, creating, onCreatingChange, onCreate } =
    props;
  const Icon = ICON[kind];
  return (
    <section className="nav-section">
      <div className="nav-head">
        <h2 className="nav-title">{title}</h2>
        <button
          type="button"
          className="icon-button nav-add"
          aria-label={`New ${kind}`}
          title={`New ${kind}`}
          onClick={() => onCreatingChange(true)}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <ul className="nav-list">
        {creating && (
          <CreateRow
            kind={kind}
            onCreate={(name) => {
              onCreatingChange(false);
              onCreate(name);
            }}
            onCancel={() => onCreatingChange(false)}
          />
        )}
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
              <Icon className="nav-icon" size={16} aria-hidden="true" />
              <span className="nav-label">{name}</span>
            </a>
          </li>
        ))}
        {names.length === 0 && !creating && (
          <li className="nav-none">No {kind}s yet</li>
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
}: {
  boards: string[];
  docs: string[];
  active: Route;
  onCreateBoard(name: string): void;
  onCreateDoc(name: string): void;
}) {
  // The list whose name field is open.
  const [open, setOpen] = useState<Kind | null>(null);

  return (
    <nav className="sidebar" aria-label="Plan files">
      <div className="brand">
        <DraftingCompass className="brand-mark" size={18} aria-hidden="true" />
        <span className="brand-name">Blueprint</span>
      </div>
      <section className="nav-section">
        <h2 className="nav-title">Plan</h2>
        <ul className="nav-list">
          {PLAN.map(([kind, label, Icon]) => (
            <li key={kind}>
              <a
                className="nav-link"
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
      />
      <NavSection
        title="Docs"
        kind="doc"
        names={docs}
        active={active}
        creating={open === "doc"}
        onCreatingChange={(on) => setOpen(on ? "doc" : null)}
        onCreate={onCreateDoc}
      />
    </nav>
  );
}
