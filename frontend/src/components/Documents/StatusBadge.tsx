import { LoaderCircle } from 'lucide-react';
import { Document } from '../../types';

export function StatusBadge({ status }: { status: Document['status'] }) {
  const colors: Record<Document['status'], string> = {
    pending: 'var(--warning)',
    processing: '#60a5fa',
    ready: 'var(--success)',
    error: 'var(--error)'
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: `${colors[status]}22`,
        border: `1px solid ${colors[status]}`,
        color: colors[status],
        fontSize: 12,
        textTransform: 'capitalize'
      }}
    >
      {status === 'processing' ? <LoaderCircle size={14} className="spin" /> : null}
      {status}
    </span>
  );
}
