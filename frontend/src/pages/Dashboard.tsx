import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Settings as SettingsIcon, Users as UsersIcon } from 'lucide-react';
import { api } from '../api/client';
import { Document } from '../types';
import { UploadZone } from '../components/Documents/UploadZone';
import { DocumentCard } from '../components/Documents/DocumentCard';
import { useAuthStore } from '../store/auth.store';

interface SettingsResponse {
  api_keys: Array<{ verified_at: string | null }>;
}

export function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [hasVerifiedKey, setHasVerifiedKey] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadDocuments = async () => {
    const { data } = await api.get<Document[]>('/documents');
    setDocuments(data);
  };

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const [{ data: docs }, { data: settings }] = await Promise.all([
        api.get<Document[]>('/documents'),
        api.get<SettingsResponse>('/settings')
      ]);
      setDocuments(docs);
      setHasVerifiedKey(settings.api_keys.some((key) => Boolean(key.verified_at)));
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const hasPending = documents.some((document) => ['pending', 'processing'].includes(document.status));
    if (!hasPending) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      void loadDocuments();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [documents]);

  return (
    <div className="page-shell">
      <header className="topbar">
        <div>
          <h1>Documentos</h1>
          <p>{user?.name}</p>
        </div>
        <div className="topbar-actions">
          {user?.role === 'admin' ? (
            <Link className="ghost-button" to="/users">
              <UsersIcon size={16} />
              Usuarios
            </Link>
          ) : null}
          <Link className="ghost-button" to="/settings">
            <SettingsIcon size={16} />
            Ajustes
          </Link>
          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              void logout().then(() => navigate('/login'));
            }}
          >
            <LogOut size={16} />
            Salir
          </button>
        </div>
      </header>

      {!hasVerifiedKey ? (
        <div className="warning-banner">
          Configura tus API keys en Ajustes antes de subir documentos. <Link to="/settings">Ir a Ajustes</Link>
        </div>
      ) : null}

      <section style={{ marginBottom: 24 }}>
        <UploadZone onUploaded={loadDocuments} />
      </section>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : (
        <div className="documents-grid">
          {documents.map((document) => (
            <DocumentCard
              key={document.id}
              document={document}
              onClick={() => {
                if (document.status === 'ready') {
                  navigate(`/chat?document_ids=${document.id}`);
                }
              }}
              onDelete={async () => {
                await api.delete(`/documents/${document.id}`);
                await loadDocuments();
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
