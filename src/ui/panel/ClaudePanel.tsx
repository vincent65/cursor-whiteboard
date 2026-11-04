import { ArrowUp, PanelRightClose, PanelRightOpen, Square } from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { AgentStatus } from "../../shared/messages";
import type { PendingPermission, PermissionDecision } from "../../shared/panel";
import * as api from "../api";
import { useSelection } from "../selection";
import { useServerEvent } from "../server-events";
import { PermissionDialog } from "./PermissionDialog";
import { useRefine } from "./refine";
import { runningTool, Thinking } from "./Thinking";
import { TranscriptList } from "./TranscriptList";
import { reduceTranscript, type TranscriptItem } from "./transcript";

type Status = { status: AgentStatus; message?: string };

const LABELS: Record<AgentStatus, string> = {
  starting: "Starting",
  idle: "Idle",
  working: "Working",
  needs_you: "Needs you",
  error: "Error",
  stopped: "Stopped",
};

const statusText = ({ status, message }: Status): string =>
  status === "error" && message ? `Error: ${message}` : LABELS[status];

// Idle goes without saying, and a working turn shows its own live row, so the
// header names only the states that need a look.
const QUIET: AgentStatus[] = ["idle", "working"];

// Prompts a first-time user can start from; a click puts one in the composer.
const BOARD_SUGGESTIONS = [
  "Describe what I selected",
  "Draw a flowchart for a sign-in flow",
  "What is missing from this plan?",
];
const SUGGESTIONS = [
  "Summarize my plan so far",
  "What is missing from this plan?",
];

// onBoard: a board is the open route, so "this board" means something.
// open: false folds the panel to a strip; it stays mounted, so a half-typed
// message and the transcript survive.
export function ClaudePanel({
  onBoard,
  open = true,
  onOpenChange,
}: {
  onBoard: boolean;
  open?: boolean;
  onOpenChange?(open: boolean): void;
}) {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [status, setStatus] = useState<Status>({ status: "starting" });
  const [pending, setPending] = useState<PendingPermission[]>([]);
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  // Set from a Stop click until the session leaves working; an interrupt takes seconds.
  const [stopping, setStopping] = useState(false);
  // When the session last started working, for the live row's timer.
  const [since, setSince] = useState<number | null>(null);
  const selection = useSelection();
  const { target, setTarget } = useRefine();
  // A live status heard before the restored state arrives is the newer one.
  const heardStatus = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);

  // The live row counts from the moment the session starts working.
  const working = status.status === "working";
  useEffect(() => {
    setSince(working ? Date.now() : null);
  }, [working]);

  // A Refine click on the board puts the cursor where the instruction goes.
  useEffect(() => {
    if (target) input.current?.focus();
  }, [target]);

  useEffect(() => {
    let cancelled = false;
    api.agentState().then(
      (s) => {
        if (cancelled) return;
        // Live events that beat the restore land on top of it.
        setItems((live) => live.reduce(reduceTranscript, s.transcript));
        setPending((live) => [
          ...s.pending,
          ...live.filter((p) => !s.pending.some((q) => q.id === p.id)),
        ]);
        if (!heardStatus.current)
          setStatus({ status: s.status, message: s.message });
      },
      (err: Error) =>
        !cancelled && setStatus({ status: "error", message: err.message }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useServerEvent((m) => {
    if (m.type === "agent.status") {
      heardStatus.current = true;
      setStatus({ status: m.status, message: m.message });
      // The server reports needs_you while any ask waits, so any other status
      // means every ask was settled, here or in another tab.
      if (m.status !== "needs_you") setPending([]);
      if (m.status !== "working" && m.status !== "needs_you")
        setStopping(false);
    } else if (m.type === "agent.event") {
      const event = m.event;
      setItems((list) => reduceTranscript(list, event));
      if (event.kind === "permission")
        setPending((list) =>
          list.some((p) => p.id === event.id) ? list : [...list, event],
        );
    }
  });

  // Follows new output only while the reader is already at the bottom; an ask's
  // dialog takes room from the transcript, so it re-pins too.
  useLayoutEffect(() => {
    const el = transcript.current;
    if (el && atBottom.current && items.length + pending.length)
      el.scrollTop = el.scrollHeight;
  }, [items, pending]);

  const onScroll = () => {
    const el = transcript.current;
    if (el)
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
  };

  const send = async () => {
    const message = text;
    if (!message.trim()) return;
    setText("");
    setFailure(null);
    const refining = target?.id;
    try {
      await api.agentSend(
        message,
        selection?.ids.length ? selection : undefined,
        refining,
      );
      // A target picked while this was in flight stays.
      setTarget((t) => (t?.id === refining ? null : t));
    } catch (err) {
      // Put the words back so a failed send loses nothing.
      setText((now) => now || message);
      setFailure((err as Error).message);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void send();
  };

  const stop = () => {
    setStopping(true);
    api.agentInterrupt().catch((err: Error) => {
      setStopping(false);
      setFailure(err.message);
    });
  };

  const compile = () => {
    setFailure(null);
    api.agentCompile().catch((err: Error) => setFailure(err.message));
  };

  const decide = (id: string) => (behavior: PermissionDecision["behavior"]) =>
    api.agentPermission(id, { behavior }).then(
      () => setPending((list) => list.filter((p) => p.id !== id)),
      (err: Error) => setFailure(err.message),
    );

  const busy =
    status.status === "starting" ||
    status.status === "working" ||
    status.status === "needs_you";
  const ask = pending[0];
  const empty = items.length === 0 && !ask;
  const suggest = (prompt: string) => {
    setText(prompt);
    input.current?.focus();
  };

  return (
    <>
      {!open && (
        <div className="panel-strip">
          <button
            type="button"
            className="icon-button"
            aria-label="Show Claude panel"
            title="Show Claude panel"
            onClick={() => onOpenChange?.(true)}
          >
            <PanelRightOpen size={18} aria-hidden="true" />
          </button>
          <span
            className="status status-dot"
            data-status={status.status}
            title={statusText(status)}
          />
        </div>
      )}
      <section className="panel" aria-label="Claude" hidden={!open}>
        <header className="panel-header">
          <h2 className="panel-title">Claude</h2>
          <span
            role="status"
            className={
              QUIET.includes(status.status) ? "status sr-only" : "status"
            }
            data-status={status.status}
            title={statusText(status)}
          >
            {statusText(status)}
          </span>
          <button
            type="button"
            className="button"
            disabled={status.status === "starting"}
            onClick={compile}
          >
            Compile
          </button>

          {onOpenChange && (
            <button
              type="button"
              className="icon-button"
              aria-label="Hide Claude panel"
              title="Hide Claude panel"
              onClick={() => onOpenChange(false)}
            >
              <PanelRightClose size={16} aria-hidden="true" />
            </button>
          )}
        </header>
        <div className="transcript" ref={transcript} onScroll={onScroll}>
          {empty ? (
            <div className="panel-empty">
              <h3 className="empty-title">Ask Claude about your plan</h3>
              <p className="empty-body">
                {onBoard
                  ? "Select shapes to ask about them. Anything Claude draws arrives as dashed shapes you accept, reject, or refine."
                  : "Claude reads your boards and documents. Open a board to ask about the shapes you select."}
              </p>
              <p className="suggestions-label" aria-hidden="true">
                Try
              </p>
              <ul className="suggestions" aria-label="Suggestions">
                {(onBoard ? BOARD_SUGGESTIONS : SUGGESTIONS).map((prompt) => (
                  <li key={prompt}>
                    <button
                      type="button"
                      className="suggestion"
                      disabled={status.status === "starting"}
                      onClick={() => suggest(prompt)}
                    >
                      {prompt}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <TranscriptList items={items} />
          )}
          {working && since !== null && (
            <Thinking since={since} activity={runningTool(items)} />
          )}
        </div>
        {ask && (
          <PermissionDialog key={ask.id} ask={ask} onDecide={decide(ask.id)} />
        )}
        {failure && (
          <p role="alert" className="panel-failure">
            {failure}
          </p>
        )}
        <div className="composer">
          {(target || (selection && selection.ids.length > 0)) && (
            <div className="chips">
              {target && (
                <span className="chip chip-refine">
                  <span className="chip-label">
                    Refining {target.title ?? "the proposal"}
                  </span>
                  <button
                    type="button"
                    className="chip-clear"
                    aria-label="Clear refine"
                    onClick={() => {
                      setTarget(null);
                      input.current?.focus();
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
              {selection && selection.ids.length > 0 && (
                <span className="chip">
                  {selection.ids.length} selected: {selection.labels.join(", ")}
                </span>
              )}
            </div>
          )}
          <div className="composer-box">
            <textarea
              ref={input}
              aria-label="Message Claude"
              placeholder={
                onBoard
                  ? "Ask Claude anything about this board"
                  : "Ask Claude anything"
              }
              rows={2}
              value={text}
              disabled={status.status === "starting"}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <div className="composer-foot">
              <span className="composer-hint">
                Enter to send, Shift+Enter for a new line
              </span>
              {busy ? (
                // While Claude works, Send becomes Stop; Enter still queues a message.
                <button
                  type="button"
                  className="send-button send-button-stop"
                  title="Stop"
                  disabled={stopping}
                  onClick={stop}
                >
                  <Square
                    size={12}
                    fill="currentColor"
                    strokeWidth={0}
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    {stopping ? "Stopping…" : "Stop"}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  className="send-button"
                  aria-label="Send"
                  title="Send"
                  disabled={!text.trim()}
                  onClick={() => void send()}
                >
                  <ArrowUp size={16} strokeWidth={2.25} aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
