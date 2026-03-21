import { FileText, Trash2 } from 'lucide-react';
import { Document } from '../../types';
import { StatusBadge } from './StatusBadge';

function formatBytes(size: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function DocumentCard({
  document,
  onClick,
  onDelete
}: {
  document: Document;
  onClick: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: 18,
        color: 'var(--text-primary)',
        cursor: document.status === 'ready' ? 'pointer' : 'default'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <FileText size={18} />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{document.original_name}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              {formatBytes(document.file_size)} • {document.page_count} páginas
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={document.status} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
              e.currentTarget.style.color = 'var(--error)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
        {new Date(document.created_at).toLocaleString()}
      </div>
      {document.status === 'ready' && document.embedding_provider ? (
        <div style={{ marginTop: 12 }}>
          <span
            style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 999,
              padding: '4px 10px'
            }}
          >
            {document.embedding_provider}
          </span>
        </div>
      ) : null}
      {document.status === 'error' && document.error_msg ? (
        <div style={{ marginTop: 12, color: 'var(--error)', fontSize: 13 }}>{document.error_msg}</div>
      ) : null}
    </div>
  );
}
