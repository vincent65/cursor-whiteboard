import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ClientMessage, ServerMessage } from "../shared/messages";
import { connectWs } from "./api";

type Handler = (m: ServerMessage) => void;

type ServerEvents = {
  subscribe(handler: Handler): () => void;
  send(m: ClientMessage): void;
};

const Context = createContext<ServerEvents | null>(null);

// One socket per tab, shared by every view and panel that talks to the server.
export function ServerEventsProvider({ children }: { children: ReactNode }) {
  const [events] = useState(() => {
    const handlers = new Set<Handler>();
    // Children's mount effects run before this provider's, so sends made
    // before the socket exists wait here.
    let pending: ClientMessage[] = [];
    let conn: ReturnType<typeof connectWs> | null = null;
    return {
      subscribe(handler: Handler) {
        handlers.add(handler);
        return () => {
          handlers.delete(handler);
        };
      },
      send(m: ClientMessage) {
        if (conn) conn.send(m);
        else pending.push(m);
      },
      connect() {
        const c = connectWs((m) => {
          // One broken view must not stop the others hearing the server.
          for (const h of handlers)
            try {
              h(m);
            } catch (err) {
              console.error(err);
            }
        });
        conn = c;
        for (const m of pending) c.send(m);
        pending = [];
        return () => {
          c.close();
          conn = null;
        };
      },
    };
  });

  useEffect(() => events.connect(), [events]);

  return <Context.Provider value={events}>{children}</Context.Provider>;
}

function useServerEvents(): ServerEvents {
  const events = useContext(Context);
  if (!events) throw new Error("ServerEventsProvider is missing");
  return events;
}

// Subscribes once per mount; the latest handler sees each message.
export function useServerEvent(handler: Handler): void {
  const events = useServerEvents();
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  useEffect(() => events.subscribe((m) => latest.current(m)), [events]);
}

export function useSendToServer(): (m: ClientMessage) => void {
  return useServerEvents().send;
}
