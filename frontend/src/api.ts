import type { Job, JobStatus, AuditEvent } from './types';

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(body?.message ?? `Request failed (${res.status})`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  listJobs(): Promise<Job[]> {
    return fetch(`${API_URL}/jobs`).then((r) => handleResponse<Job[]>(r));
  },

  createJob(title: string, type: string): Promise<Job> {
    return fetch(`${API_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, type }),
    }).then((r) => handleResponse<Job>(r));
  },

  updateStatus(id: string, status: JobStatus): Promise<Job> {
    return fetch(`${API_URL}/jobs/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).then((r) => handleResponse<Job>(r));
  },

  deleteJob(id: string): Promise<void> {
    return fetch(`${API_URL}/jobs/${id}`, { method: 'DELETE' }).then((r) => handleResponse<void>(r));
  },

  recheckJob(id: string): Promise<AuditEvent> {
  return fetch(`${API_URL}/jobs/${id}/audit/recheck`, { method: 'POST' }).then((r) => handleResponse<AuditEvent>(r));
},

  getFlaggedEvents(): Promise<AuditEvent[]> {
    return fetch(`${API_URL}/jobs/audit/flagged`).then((r) => handleResponse<AuditEvent[]>(r));
  },
};