import { useState } from 'react';
import type { Job, JobStatus } from '../types';
import { NEXT_STATUSES } from '../types';

const STATUS_COLOR: Record<JobStatus, string> = {
  pending: 'border-l-pending',
  running: 'border-l-running',
  completed: 'border-l-completed',
  failed: 'border-l-failed',
};

interface Props {
  job: Job;
  onMove: (id: string, status: JobStatus) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, job: Job) => void;
}

export default function JobCard({ job, onMove, onDelete, draggable, onDragStart }: Props) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const nextOptions = NEXT_STATUSES[job.status];

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, job)}
      onMouseLeave={() => setConfirmingDelete(false)}
      className={`group bg-surface border border-border border-l-4 ${STATUS_COLOR[job.status]} rounded-sm p-3 cursor-grab active:cursor-grabbing hover:border-muted hover:-translate-y-0.5 transition-all`}
    >
      <div className="font-mono text-sm text-text truncate">{job.title}</div>
      <div className="font-mono text-xs text-muted mt-1">{job.type}</div>
      <div className="font-mono text-[11px] text-muted/70 mt-1">
        {new Date(job.createdAt).toLocaleString()}
      </div>

      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        {nextOptions.map((next) => (
          <button
            key={next}
            onClick={() => onMove(job.id, next)}
            className="text-[11px] font-mono px-2 py-1 border border-border rounded-sm text-muted hover:text-text hover:border-text transition-colors"
          >
            → {next}
          </button>
        ))}

        {confirmingDelete ? (
          <button
            onClick={() => onDelete(job.id)}
            className="text-[11px] font-mono px-2 py-1 border border-failed bg-failed text-bg rounded-sm ml-auto animate-pulse"
          >
            confirm?
          </button>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-[11px] font-mono px-2 py-1 border border-border rounded-sm text-muted opacity-0 group-hover:opacity-100 hover:text-failed hover:border-failed transition-all ml-auto"
          >
            delete
          </button>
        )}
      </div>
    </div>
  );
}