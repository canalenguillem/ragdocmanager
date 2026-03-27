import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { AdminUser } from '../types';

export function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);

  useEffect(() => {
    void loadUsers();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<AdminUser[]>('/admin/users');
      setUsers(data);
    } catch {
      setError('Error cargando usuarios');
    } finally {
      setLoading(false);
    }
  }

  function updateLocalUser(id: number, patch: Partial<AdminUser>) {
    setUsers((current) => current.map((user) => (user.id === id ? { ...user, ...patch } : user)));
  }

  async function saveUser(user: AdminUser) {
    setSavingId(user.id);
    setError('');
    try {
      await api.patch(`/admin/users/${user.id}`, {
        name: user.name,
        email: user.email,
        phone: user.phone ?? null,
        role: user.role
      });
      await loadUsers();
    } catch {
      setError(`No se pudo guardar el usuario ${user.email}`);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`¿Eliminar a ${user.email}? Esta acción borrará sus documentos y chats.`)) {
      return;
    }

    setSavingId(user.id);
    setError('');
    try {
      await api.delete(`/admin/users/${user.id}`);
      await loadUsers();
    } catch {
      setError(`No se pudo eliminar el usuario ${user.email}`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 16px', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, margin: 0 }}>Usuarios</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '8px 0 0' }}>Administración básica de cuentas</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/dashboard" className="ghost-button">Volver al dashboard</Link>
          <Link to="/settings" className="ghost-button">Ajustes</Link>
        </div>
      </div>

      {error ? (
        <div style={{ background: '#ef444422', border: '1px solid var(--error)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: 'var(--error)' }}>
          {error}
        </div>
      ) : null}

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Cargando usuarios...</div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {users.map((user) => (
            <div
              key={user.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1.1fr 1fr 1fr 140px 90px 90px auto',
                gap: 12,
                alignItems: 'center',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 12,
                padding: 16
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Nombre</div>
                <input
                  value={user.name}
                  onChange={(e) => updateLocalUser(user.id, { name: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</div>
                <input
                  value={user.email}
                  onChange={(e) => updateLocalUser(user.id, { email: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Teléfono</div>
                <input
                  value={user.phone ?? ''}
                  onChange={(e) => updateLocalUser(user.id, { phone: e.target.value || null })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Rol</div>
                <select
                  value={user.role}
                  onChange={(e) => updateLocalUser(user.id, { role: e.target.value as AdminUser['role'] })}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)' }}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Docs</div>
                <div>{user.document_count}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>Chats</div>
                <div>{user.chat_count}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => void saveUser(user)}
                  disabled={savingId === user.id}
                  className="ghost-button"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => void deleteUser(user)}
                  disabled={savingId === user.id}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--error)',
                    background: 'transparent',
                    color: 'var(--error)',
                    cursor: 'pointer'
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
