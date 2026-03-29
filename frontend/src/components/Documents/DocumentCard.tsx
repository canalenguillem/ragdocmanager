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
      className={`document-card ${document.status === 'ready' ? 'is-ready' : ''}`}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div className="document-card-icon">
            <FileText size={18} />
          </div>
          <div>
            <div className="document-card-title">{document.original_name}</div>
            <div className="document-card-meta">
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
            className="document-delete-btn"
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
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
      <div className="document-card-date">
        {new Date(document.created_at).toLocaleString()}
      </div>
      {document.status === 'ready' && document.embedding_provider ? (
        <div style={{ marginTop: 14 }}>
          <span className="document-provider-chip">
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
