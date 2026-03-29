import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Settings as SettingsIcon, Users as UsersIcon } from 'lucide-react';
import { api } from '../api/client';
import { Document } from '../types';
import { UploadZone } from '../components/Documents/UploadZone';
import { DocumentCard } from '../components/Documents/DocumentCard';
import { SiteFooter } from '../components/Layout/SiteFooter';
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
  const readyCount = documents.filter((document) => document.status === 'ready').length;
  const processingCount = documents.filter((document) => ['pending', 'processing'].includes(document.status)).length;

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

      <section className="dashboard-hero">
        <div>
          <span className="auth-eyebrow">Workspace documental</span>
          <h2>Organiza manuales, boletines y normas en un solo lugar</h2>
          <p>
            Sube PDFs, ordénalos por carpetas y entra a conversar con cada documento con trazabilidad por fuente.
          </p>
        </div>
        <div className="dashboard-stats">
          <div className="dashboard-stat">
            <strong>{documents.length}</strong>
            <span>documentos</span>
          </div>
          <div className="dashboard-stat">
            <strong>{readyCount}</strong>
            <span>listos</span>
          </div>
          <div className="dashboard-stat">
            <strong>{processingCount}</strong>
            <span>procesando</span>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <UploadZone onUploaded={loadDocuments} />
      </section>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Cargando...</div>
      ) : (
        <>
          <div className="dashboard-section-head">
            <div>
              <h3>Biblioteca</h3>
              <p>Pulsa cualquier documento listo para entrar directamente al chat contextual.</p>
            </div>
          </div>
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
        </>
      )}
      <SiteFooter />
    </div>
  );
}
