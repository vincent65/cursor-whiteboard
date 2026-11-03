import {
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { PanelEvent, PermissionDecision } from "../../shared/panel";
import type { RunView } from "../../shared/runs";
import type { RunStatus } from "../../shared/types";
import { Inline } from "../markdown";
import { PermissionDialog } from "../panel/PermissionDialog";
import { TranscriptList } from "../panel/TranscriptList";

const LABELS: Record<RunStatus, string> = {
  working: "Working",
  needs_you: "Needs you",
  idle: "Idle",
  done: "Done",
  failed: "Failed",
  interrupted: "Interrupted",
};

// Plain paths go in bare; anything else is single-quoted for the shell.
const shellPath = (p: string) =>
  /^[\w./-]+$/.test(p) ? p : `'${p.replaceAll("'", `'\\''`)}'`;

type Handler<A extends unknown[] = []> = (...args: A) => unknown;

// onExpand: the transcript was opened, so the caller can load it; transcriptError: why
// loading it failed.
export function RunCard({
  run,
  transcript,
  transcriptError = null,
  onMessage,
  onStop,
  onResume,
  onDone,
  onPermission,
  onExpand,
}: {
  run: RunView;
  transcript: PanelEvent[];
  transcriptError?: string | null;
  onMessage: Handler<[text: string]>;
  onStop: Handler;
  onResume: Handler;
  onDone: Handler;
  onPermission: Handler<[id: string, decision: PermissionDecision]>;
  onExpand?(): void;
}) {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  // Set from a Stop click until the run leaves working; an interrupt takes seconds.
  const [stopping, setStopping] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const active = run.status === "working" || run.status === "needs_you";
  useEffect(() => {
    if (!active) setStopping(false);
  }, [active]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // An opened transcript starts at its end and follows new output while read there.
  useLayoutEffect(() => {
    const el = list.current;
    if (el && open && atBottom.current && transcript.length)
      el.scrollTop = el.scrollHeight;
  }, [transcript, open]);

  const onScroll = () => {
    const el = list.current;
    if (el)
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
  };

  const attempt = async (action: () => unknown): Promise<boolean> => {
    setFailure(null);
    try {
      await action();
      return true;
    } catch (err) {
      setFailure((err as Error).message);
      return false;
    }
  };

  const send = async () => {
    const words = text;
    if (!words.trim()) return;
    setText("");
    // Put the words back so a failed send loses nothing.
    if (!(await attempt(() => onMessage(words))))
      setText((now) => now || words);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void send();
  };

  const copy = () =>
    attempt(async () => {
      await navigator.clipboard.writeText(
        `cd ${shellPath(run.worktree)} && claude --resume ${run.sessionId}`,
      );
      setCopied(true);
    });

  const toggle = () => {
    if (!open) {
      atBottom.current = true;
      onExpand?.();
    }
    setOpen(!open);
  };

  const status =
    run.status === "failed" && run.failure
      ? `Failed: ${run.failure}`
      : LABELS[run.status];
  const ask = run.pending[0];

  return (
    <article className="run-card" aria-label={run.taskSlug}>
      <header className="run-head">
        <h2 className="run-title" title={run.title}>
          <Inline text={run.title} />
        </h2>
        <span
          role="status"
          className="status run-status"
          data-status={run.status}
          title={status}
        >
          {status}
        </span>
      </header>
      <p className="run-meta">
        {run.title !== run.taskSlug && <span>{run.taskSlug}</span>}
        <code className="run-branch" title={run.branch}>
          {run.branch}
        </code>
        <span>${run.costUsd.toFixed(4)} total</span>
        {run.prUrl && (
          <a href={run.prUrl} target="_blank" rel="noreferrer">
            PR
          </a>
        )}
      </p>
      {run.lastText && (
        // Line by line, as Claude wrote it; a blank line would waste one of the two shown.
        <p className="run-last">
          <Inline text={run.lastText.replace(/\n\s*\n/g, "\n")} />
        </p>
      )}
      <div className="run-actions">
        <button
          type="button"
          className="button"
          aria-expanded={open}
          onClick={toggle}
        >
          {open ? "Hide transcript" : "Show transcript"}
        </button>
        {active && (
          <button
            type="button"
            className="button"
            disabled={stopping}
            onClick={async () => {
              setStopping(true);
              if (!(await attempt(onStop))) setStopping(false);
            }}
          >
            {stopping ? "Stopping…" : "Stop"}
          </button>
        )}
        {run.status === "interrupted" && (
          <button
            type="button"
            className="button"
            onClick={() => attempt(onResume)}
          >
            Resume
          </button>
        )}
        {run.status === "idle" && (
          // For a run the user finished by hand, so its dependents' gate can pass.
          <button
            type="button"
            className="button"
            onClick={() => attempt(onDone)}
          >
            Mark done
          </button>
        )}
        <button
          type="button"
          className="button run-copy"
          // A run gets its session id once Claude starts.
          disabled={!run.sessionId}
          onClick={copy}
        >
          {copied ? "Copied" : "Copy resume command"}
        </button>
      </div>
      {open && (
        <div
          className="transcript run-transcript"
          ref={list}
          onScroll={onScroll}
        >
          {transcriptError ? (
            <p role="alert" className="panel-failure">
              {transcriptError}
            </p>
          ) : transcript.length ? (
            <TranscriptList items={transcript} />
          ) : (
            <p className="muted">Nothing yet.</p>
          )}
        </div>
      )}
      {ask && (
        <PermissionDialog
          key={ask.id}
          ask={ask}
          onDecide={(behavior) =>
            attempt(() => onPermission(ask.id, { behavior }))
          }
        />
      )}
      {failure && (
        <p role="alert" className="panel-failure">
          {failure}
        </p>
      )}
      <textarea
        className="run-input"
        aria-label={`Message ${run.taskSlug}`}
        placeholder="Message this run"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </article>
  );
}
