import { useEffect, useState } from 'react';

interface AuditEvent {
  timestamp: string;
  jobId: string;
  jobTitle: string;
  from: string;
  to: string;
  reasons: string[];
  summary: string;
}

const API_URL = import.meta.env.VITE_API_URL;

function ruleLabel(reasons: string[]): string {
  const raw = reasons[0]?.split(':')[0] ?? 'anomaly';
  return raw.replace(/_/g, ' ');
}

export default function AuditPanel() {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!open) return;
    const fetchLog = () =>
      fetch(`${API_URL}/jobs/audit/flagged`)
        .then((r) => r.json())
        .then((data: AuditEvent[]) => {
          setEvents((prev) => {
            if (data.length > prev.length) {
              setPulse(true);
              setTimeout(() => setPulse(false), 1000);
            }
            return data;
          });
        })
        .catch(() => {});
    fetchLog();
    const id = setInterval(fetchLog, 5000);
    return () => clearInterval(id);
  }, [open]);

  return (
    <div className="border border-border rounded-sm bg-surface overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-bg/40 transition-colors"
      >
        <span className="text-muted text-xs">{open ? '▾' : '▸'}</span>

        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-running opacity-75" />
          )}
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-running" />
        </span>

        <span className="text-xs font-medium text-text">AI audit agent</span>
        <span className="text-[10px] font-mono text-muted/60">gpt-oss-120b</span>

        {events.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded-full bg-failed/15 text-failed text-[10px] font-mono font-medium">
            {events.length} flagged
          </span>
        )}
        {events.length === 0 && (
          <span className="ml-auto text-[10px] font-mono text-muted/50">watching</span>
        )}
      </button>

      {open && (
        <div className="border-t border-border max-h-72 overflow-y-auto">
          {events.length === 0 ? (
            <div className="flex flex-col items-center gap-1 py-8 text-center">
              <span className="text-muted/40 text-lg">◎</span>
              <p className="text-[11px] text-muted/60 font-mono">no anomalies detected</p>
            </div>
          ) : (
            events.map((e, i) => (
              <div
                key={i}
                className="px-3 py-2.5 border-b border-border last:border-0 border-l-2 border-l-failed/60"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-text">{e.jobTitle}</span>
                  <span className="px-1.5 py-0.5 rounded-sm bg-pending/15 text-pending text-[10px] font-mono capitalize">
                    {ruleLabel(e.reasons)}
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-muted/50">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-[13px] text-muted mt-1.5 leading-snug">{e.summary}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}