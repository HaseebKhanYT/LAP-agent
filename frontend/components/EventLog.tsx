"use client";

import { useEffect, useRef, useState } from "react";
import { runEventsUrl } from "@/lib/api";
import { cn, formatTime } from "@/lib/format";
import type { RunEvent } from "@/lib/types";

type ConnState = "connecting" | "open" | "error" | "closed";

const MAX_EVENTS = 500;

/**
 * Subscribes to the run's SSE event stream and renders a live, auto-scrolling
 * log. Handles connection errors and closed streams gracefully: it shows a
 * status indicator and never throws if the backend is unreachable.
 */
export function EventLog({ runId }: { runId: string }) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [conn, setConn] = useState<ConnState>("connecting");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let source: EventSource | null = null;
    let cancelled = false;

    try {
      source = new EventSource(runEventsUrl(runId));
    } catch {
      setConn("error");
      return;
    }

    source.onopen = () => {
      if (!cancelled) setConn("open");
    };

    source.onmessage = (ev: MessageEvent<string>) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(ev.data) as RunEvent;
        setEvents((prev) => {
          const next = [...prev, parsed];
          return next.length > MAX_EVENTS
            ? next.slice(next.length - MAX_EVENTS)
            : next;
        });
      } catch {
        // Ignore malformed frames rather than crashing the stream.
      }
    };

    source.onerror = () => {
      if (cancelled) return;
      // EventSource auto-reconnects unless closed; reflect the interim state.
      setConn((prev) => (prev === "open" ? "open" : "error"));
    };

    return () => {
      cancelled = true;
      source?.close();
      setConn("closed");
    };
  }, [runId]);

  // Auto-scroll to bottom on new events when enabled.
  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events, autoScroll]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <ConnIndicator state={conn} count={events.length} />
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="accent-accent"
          />
          Auto-scroll
        </label>
      </div>

      <div
        ref={scrollRef}
        className="scroll-thin h-80 overflow-y-auto rounded-lg border border-border bg-bg p-3 font-mono text-xs"
      >
        {events.length === 0 ? (
          <p className="text-muted">
            {conn === "error"
              ? "No live stream. The backend may be offline or the run has no events yet."
              : "Waiting for events…"}
          </p>
        ) : (
          <ul className="space-y-1">
            {events.map((ev, i) => (
              <li key={`${ev.ts}-${i}`} className="flex gap-2 leading-relaxed">
                <span className="shrink-0 text-muted">
                  {formatTime(ev.ts)}
                </span>
                <span className="shrink-0 text-accent">[{ev.node}]</span>
                <span className="shrink-0 text-warn">{ev.type}</span>
                <span className="break-words text-slate-300">
                  {ev.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConnIndicator({
  state,
  count,
}: {
  state: ConnState;
  count: number;
}) {
  const meta: Record<ConnState, { color: string; label: string }> = {
    connecting: { color: "bg-warn", label: "connecting" },
    open: { color: "bg-ok", label: "live" },
    error: { color: "bg-danger", label: "reconnecting" },
    closed: { color: "bg-slate-500", label: "closed" },
  };
  const { color, label } = meta[state];
  return (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          color,
          state === "open" && "animate-pulse",
        )}
      />
      {label} · {count} events
    </span>
  );
}
