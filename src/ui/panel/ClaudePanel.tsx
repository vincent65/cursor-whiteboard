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

function Item({ item }: { item: TranscriptItem }) {
  switch (item.kind) {
    case "user":
      return <div className="msg-user">{item.text}</div>;
    case "assistant_text":
      return <p className="msg-assistant">{item.text}</p>;
    case "tool_use":
      return <div className="msg-tool">{item.summary}</div>;
    case "tool_result":
      return (
        <div className="msg-tool">
          {!item.ok && (
            <span role="img" aria-label="failed">
              ✗{" "}
            </span>
          )}
          {item.summary}
        </div>
      );
    case "result": {
      // The SDK's cost is the session's running total, not this turn's.
      const cost =
        item.costUsd === null ? "" : ` · $${item.costUsd.toFixed(4)} total`;
      return (
        <div className="msg-result">
          {item.subtype === "interrupted" ? "Stopped" : "Done"}
          {cost}
        </div>
      );
    }
    case "error":
      return <div className="msg-result">✗ {item.message}</div>;
    case "permission":
      // reduceTranscript keeps asks out; they wait in the dialog.
      return null;
  }
}

export function ClaudePanel() {
  const [items, setItems] = useState<TranscriptItem[]>([]);
  const [status, setStatus] = useState<Status>({ status: "starting" });
  const [pending, setPending] = useState<PendingPermission[]>([]);
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const selection = useSelection();
  const { target, setTarget } = useRefine();
  // A live status heard before the restored state arrives is the newer one.
  const heardStatus = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const input = useRef<HTMLTextAreaElement>(null);

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

  const stop = () =>
    api.agentInterrupt().catch((err: Error) => setFailure(err.message));

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

  return (
    <section className="panel" aria-label="Claude">
      <header className="panel-header">
        <h2 className="panel-title">Claude</h2>
        <span
          role="status"
          className="status"
          data-status={status.status}
          title={statusText(status)}
        >
          {statusText(status)}
        </span>
        <button
          type="button"
          className="button"
          disabled={!busy}
          onClick={stop}
        >
          Stop
        </button>
      </header>
      <div className="transcript" ref={transcript} onScroll={onScroll}>
        {items.map((item) => (
          <Item key={item.id} item={item} />
        ))}
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
                  Refining {target.id}
                  {target.title ? ` · ${target.title}` : ""}
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
        <textarea
          ref={input}
          aria-label="Message Claude"
          placeholder="Ask Claude about this board"
          rows={3}
          value={text}
          disabled={status.status === "starting"}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
    </section>
  );
}
