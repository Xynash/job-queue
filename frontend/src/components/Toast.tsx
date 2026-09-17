interface ToastItem {
  id: string;
  message: string;
  tone: 'error' | 'success';
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export default function Toast({ toasts, onDismiss }: Props) {
  return (
    <div className="fixed top-4 right-4 flex flex-col gap-2 z-50 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={`font-mono text-xs px-3 py-2.5 rounded-sm border cursor-pointer shadow-lg backdrop-blur-sm ${
            t.tone === 'error'
              ? 'bg-failed/10 border-failed text-failed'
              : 'bg-completed/10 border-completed text-completed'
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}