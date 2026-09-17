import type { Job, JobStatus } from '../types';
import JobCard from './JobCard';

const STATUS_LABEL: Record<JobStatus, string> = {
  pending: 'pending',
  running: 'running',
  completed: 'completed',
  failed: 'failed',
};

const STATUS_DOT: Record<JobStatus, string> = {
  pending: 'bg-pending',
  running: 'bg-running',
  completed: 'bg-completed',
  failed: 'bg-failed',
};

const STATUS_BORDER_TOP: Record<JobStatus, string> = {
  pending: 'border-t-pending',
  running: 'border-t-running',
  completed: 'border-t-completed',
  failed: 'border-t-failed',
};

interface Props {
  status: JobStatus;
  jobs: Job[];
  isDragOver: boolean;
  onMove: (id: string, status: JobStatus) => void;
  onDelete: (id: string) => void;
  onDragStart: (e: React.DragEvent, job: Job) => void;
  onDragEnter: (status: JobStatus) => void;
  onDragLeave: () => void;
  onDrop: (status: JobStatus) => void;
}

export default function Column({
  status,
  jobs,
  isDragOver,
  onMove,
  onDelete,
  onDragStart,
  onDragEnter,
  onDragLeave,
  onDrop,
}: Props) {
  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={() => onDragEnter(status)}
      onDragLeave={onDragLeave}
      onDrop={() => onDrop(status)}
      className={`flex-1 min-w-[260px] bg-bg border border-t-2 rounded-sm flex flex-col h-full transition-colors ${
        STATUS_BORDER_TOP[status]
      } ${isDragOver ? 'border-muted bg-surface/50' : 'border-border'}`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
        <span className="text-sm font-medium">{STATUS_LABEL[status]}</span>
        <span className="ml-auto text-xs font-mono text-muted">{jobs.length}</span>
      </div>

      <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
        {jobs.length === 0 ? (
          <div className="flex-1 flex items-center justify-center min-h-[100px] m-1 border border-dashed border-border rounded-sm">
            <span className="text-[11px] text-muted/60 font-mono">no jobs</span>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onMove={onMove}
              onDelete={onDelete}
              draggable
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}