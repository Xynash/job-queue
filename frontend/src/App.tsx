import { useEffect, useState } from 'react';
import { api } from './api';
import type { Job, JobStatus } from './types';
import { STATUSES } from './types';
import Column from './components/Column';
import JobForm from './components/JobForm';
import Toast from './components/Toast';
import AuditPanel from './components/AuditPanel';

interface ToastItem {
  id: string;
  message: string;
  tone: 'error' | 'success';
}

export default function App() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragJob, setDragJob] = useState<Job | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<JobStatus | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  function pushToast(message: string, tone: ToastItem['tone']) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  async function loadJobs() {
    setLoadError(null);
    try {
      setJobs(await api.listJobs());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'could not reach the API');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadJobs();
  }, []);

  async function handleCreate(title: string, type: string) {
    const job = await api.createJob(title, type);
    setJobs((prev) => [job, ...prev]);
    pushToast(`created "${job.title}"`, 'success');
  }

  async function handleMove(id: string, status: JobStatus) {
    try {
      const updated = await api.updateStatus(id, status);
      setJobs((prev) => prev.map((j) => (j.id === id ? updated : j)));
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'could not update status', 'error');
    }
  }

  async function handleDelete(id: string) {
    const job = jobs.find((j) => j.id === id);
    try {
      await api.deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
      if (job) pushToast(`deleted "${job.title}"`, 'success');
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'could not delete job', 'error');
    }
  }

  function handleDragStart(e: React.DragEvent, job: Job) {
    setDragJob(job);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDrop(status: JobStatus) {
    if (dragJob && dragJob.status !== status) {
      handleMove(dragJob.id, status);
    }
    setDragJob(null);
    setDragOverStatus(null);
  }

  return (
    <div className="h-screen flex flex-col">
      <Toast toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />

      <header className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-semibold">job queue</h1>
          <p className="text-xs text-muted font-mono mt-0.5">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${loadError ? 'bg-failed' : 'bg-completed'}`} />
          <span className="text-[11px] font-mono text-muted">{loadError ? 'disconnected' : 'connected'}</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
        <JobForm onCreate={handleCreate} />
        <AuditPanel />

        {loading ? (
          <div className="flex-1 flex gap-3">
            {STATUSES.map((s) => (
              <div key={s} className="flex-1 min-w-[260px] bg-surface/40 border border-border rounded-sm animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex items-center gap-3 text-sm font-mono text-failed">
            <span>{loadError}</span>
            <button
              onClick={() => { setLoading(true); loadJobs(); }}
              className="px-2 py-1 border border-failed rounded-sm hover:bg-failed hover:text-bg transition-colors"
            >
              retry
            </button>
          </div>
        ) : (
          <div className="flex-1 flex gap-3 overflow-x-auto">
            {STATUSES.map((status) => (
              <Column
                key={status}
                status={status}
                jobs={jobs.filter((j) => j.status === status)}
                isDragOver={dragOverStatus === status}
                onMove={handleMove}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                onDragEnter={setDragOverStatus}
                onDragLeave={() => setDragOverStatus(null)}
                onDrop={handleDrop}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}