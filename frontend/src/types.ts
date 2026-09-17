export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface Job {
  id: string;
  title: string;
  type: string;
  status: JobStatus;
  createdAt: string;
}

export interface AuditEvent {
  timestamp: string;
  jobId: string;
  jobTitle: string;
  from: string;
  to: string;
  flagged: boolean;
  reasons: string[];
}

export const STATUSES: JobStatus[] = ['pending', 'running', 'completed', 'failed'];

// Mirrors the backend's transition map — UX-only, greys out illegal
// moves. The backend is what actually enforces this; if these two
// maps ever disagree, the backend wins and the user gets a 409.
export const NEXT_STATUSES: Record<JobStatus, JobStatus[]> = {
  pending: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
};