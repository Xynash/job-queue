import { useState } from 'react';
import type { FormEvent } from 'react';

interface Props {
  onCreate: (title: string, type: string) => Promise<void>;
}

export default function JobForm({ onCreate }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !type.trim()) {
      setError('title and type are both required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(title.trim(), type.trim());
      setTitle('');
      setType('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to create job');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-3 bg-surface border border-border rounded-sm">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted font-mono">title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="nightly-report-export"
          className="bg-bg border border-border rounded-sm px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-running w-56"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted font-mono">type</label>
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="email"
          className="bg-bg border border-border rounded-sm px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-running w-40"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="text-sm font-mono px-3 py-1.5 border border-running text-running rounded-sm hover:bg-running hover:text-bg transition-colors disabled:opacity-50"
      >
        {submitting ? 'adding…' : '+ add job'}
      </button>
      {error && <span className="text-xs text-failed font-mono">{error}</span>}
    </form>
  );
}