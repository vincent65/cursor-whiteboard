import type {
  PermissionResult,
  PermissionUpdate,
} from "@anthropic-ai/claude-agent-sdk";
import type {
  PendingPermission,
  PermissionDecision,
} from "../../shared/panel.js";
import { relativeTo, summarizeTool } from "./events.js";

const DEFAULT_DENY = "The user denied this action in Blueprint.";

type Open = {
  entry: PendingPermission;
  suggestions?: PermissionUpdate[];
  settle(result: PermissionResult): void;
};

export class PermissionBroker {
  #open = new Map<string, Open>();
  #onChange: (pending: PendingPermission[]) => void;
  #relativize: (text: string) => string;

  // cwd: the session's directory, which asks leave out of the paths they show.
  constructor(opts: {
    cwd?: string;
    onChange(pending: PendingPermission[]): void;
  }) {
    this.#onChange = opts.onChange;
    this.#relativize = relativeTo(opts.cwd);
  }

  ask(req: {
    toolUseID: string;
    tool: string;
    input: Record<string, unknown>;
    suggestions?: PermissionUpdate[];
    signal: AbortSignal;
  }): Promise<PermissionResult> {
    if (req.signal.aborted)
      return Promise.resolve({ behavior: "deny", message: "interrupted" });
    return new Promise((resolve) => {
      const id = req.toolUseID;
      const onAbort = () =>
        this.#settle(id, { behavior: "deny", message: "interrupted" });
      req.signal.addEventListener("abort", onAbort, { once: true });
      this.#open.set(id, {
        entry: {
          id,
          tool: req.tool,
          summary: summarizeTool(req.tool, req.input, this.#relativize),
          canAlways: !!req.suggestions?.length,
          at: new Date().toISOString(),
        },
        suggestions: req.suggestions,
        settle: (result) => {
          req.signal.removeEventListener("abort", onAbort);
          resolve(result);
        },
      });
      this.#onChange(this.pending());
    });
  }

  answer(id: string, decision: PermissionDecision): boolean {
    const open = this.#open.get(id);
    if (!open) return false;
    // Without suggestions there is no rule to keep, so always allows this once.
    if (decision.behavior === "always" && open.entry.canAlways) {
      this.#settle(id, {
        behavior: "allow",
        updatedPermissions: open.suggestions,
      });
    } else if (decision.behavior !== "deny") {
      this.#settle(id, { behavior: "allow" });
    } else {
      this.#settle(id, {
        behavior: "deny",
        message: decision.message ?? DEFAULT_DENY,
      });
    }
    return true;
  }

  pending(): PendingPermission[] {
    return [...this.#open.values()].map((open) => open.entry);
  }

  cancelAll(reason: string): void {
    if (this.#open.size === 0) return;
    const open = [...this.#open.values()];
    this.#open.clear();
    for (const o of open) o.settle({ behavior: "deny", message: reason });
    this.#onChange([]);
  }

  #settle(id: string, result: PermissionResult): void {
    const open = this.#open.get(id);
    if (!open) return;
    this.#open.delete(id);
    open.settle(result);
    this.#onChange(this.pending());
  }
}
