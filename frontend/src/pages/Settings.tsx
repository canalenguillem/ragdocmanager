import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ApiKey, UserSettings, AvailableModels, EmbeddingProvider } from '../types';

type Tab = 'keys' | 'preferences';

export function Settings() {
  const visibleProviders: EmbeddingProvider[] = ['openai'];
  const [tab, setTab] = useState<Tab>('keys');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [availableModels, setAvailableModels] = useState<AvailableModels | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newProvider, setNewProvider] = useState<EmbeddingProvider>('openai');
  const [newKeyType, setNewKeyType] = useState<'embedding' | 'chat' | 'both'>('both');
  const [newApiKey, setNewApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    try {
      const { data } = await api.get('/settings');
      setApiKeys(data.api_keys);
      setSettings(data.settings);
      setAvailableModels(data.available_models);
    } catch {
      setError('Error cargando configuración');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddKey(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/settings/api-keys', {
        provider: newProvider,
        key_type: newKeyType,
        api_key: newApiKey
      });
      if (data.verified) {
        setSuccess(`✓ API key de ${newProvider} guardada y verificada correctamente.`);
      } else {
        setSuccess(`API key guardada. Advertencia: ${data.error ?? 'no se pudo verificar'}`);
      }
      setNewApiKey('');
      await loadSettings();
    } catch {
      setError('Error guardando la API key');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteKey(id: number) {
    if (!window.confirm('¿Eliminar esta API key?')) return;
    await api.delete(`/settings/api-keys/${id}`);
    await loadSettings();
  }

  async function handleVerifyKey(id: number) {
    try {
      const { data } = await api.post(`/settings/api-keys/${id}/verify`);
      setSuccess(data.ok ? '✓ Key verificada correctamente' : `Error: ${data.error}`);
      await loadSettings();
    } catch {
      setError('Error al verificar');
    }
  }

  async function handleUpdateSettings(field: keyof UserSettings, value: string | number) {
    if (!settings) {
      return;
    }

    const updated = { ...settings, [field]: value };
    const payload: Partial<UserSettings> = { [field]: value };

    if (field === 'embedding_provider' && availableModels) {
      const models = availableModels[value as keyof AvailableModels] ?? [];
      if (models.length) {
        updated.embedding_model = models[0].model;
        updated.embedding_dimensions = models[0].dimensions;
        payload.embedding_model = models[0].model;
        payload.embedding_dimensions = models[0].dimensions;
      }
    } else if (field === 'embedding_model' && availableModels) {
      const found = (availableModels[settings.embedding_provider] ?? []).find((m) => m.model === value);
      if (found) {
        updated.embedding_dimensions = found.dimensions;
        payload.embedding_dimensions = found.dimensions;
      }
    }

    setSettings(updated);
    try {
      await api.put('/settings', payload);
    } catch {
      setError('Error guardando preferencias');
    }
  }

  if (loading) return <div style={{ color: 'var(--text-secondary)', padding: 32 }}>Cargando...</div>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '32px 16px', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, margin: 0 }}>⚙ Ajustes</h1>
        <Link
          to="/dashboard"
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          Volver al dashboard
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
        {(['keys', 'preferences'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              background: tab === t ? 'var(--accent)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              fontWeight: tab === t ? 600 : 400
            }}
          >
            {t === 'keys' ? '🔑 API Keys' : '🤖 Preferencias IA'}
          </button>
        ))}
      </div>

      {error ? <div style={{ background: '#ef444422', border: '1px solid var(--error)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--error)' }}>{error}</div> : null}
      {success ? <div style={{ background: '#22c55e22', border: '1px solid var(--success)', borderRadius: 6, padding: '10px 14px', marginBottom: 16, color: 'var(--success)' }}>{success}</div> : null}

      {tab === 'keys' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: 14 }}>
            Las API keys se almacenan cifradas (AES-256) en la base de datos del servidor.
            Nunca se muestran en texto plano una vez guardadas.
          </p>

          {apiKeys.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Keys guardadas</h3>
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '12px 16px',
                    marginBottom: 8
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 600, marginRight: 8 }}>{k.provider}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '2px 8px', borderRadius: 4 }}>{k.key_type}</span>
                    {k.verified_at ? (
                      <span style={{ marginLeft: 10, color: 'var(--success)', fontSize: 12 }}>✓ verificada</span>
                    ) : (
                      <span style={{ marginLeft: 10, color: 'var(--warning)', fontSize: 12 }}>⚠ sin verificar</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => void handleVerifyKey(k.id)} style={{ padding: '4px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}>Verificar</button>
                    <button onClick={() => void handleDeleteKey(k.id)} style={{ padding: '4px 12px', background: 'transparent', border: '1px solid var(--error)', borderRadius: 6, color: 'var(--error)', cursor: 'pointer', fontSize: 12 }}>Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <h3 style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Añadir nueva key</h3>
          <form onSubmit={handleAddKey} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 12 }}>
              <select value={newProvider} onChange={(e) => setNewProvider(e.target.value as EmbeddingProvider)} style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                <option value="openai">OpenAI</option>
              </select>
              <select value={newKeyType} onChange={(e) => setNewKeyType(e.target.value as 'embedding' | 'chat' | 'both')} style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                <option value="both">Embeddings + Chat</option>
                <option value="embedding">Solo Embeddings</option>
                <option value="chat">Solo Chat</option>
              </select>
            </div>
            <input
              type="password"
              placeholder="sk-... / AIza..."
              value={newApiKey}
              onChange={(e) => setNewApiKey(e.target.value)}
              required
              style={{ padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontSize: 14 }}
            />
            <button type="submit" disabled={saving} style={{ padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Guardando y verificando...' : 'Guardar API Key'}
            </button>
          </form>
        </div>
      )}

      {tab === 'preferences' && settings && availableModels && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>🔢 Embeddings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Proveedor</label>
              <select value={settings.embedding_provider} onChange={(e) => void handleUpdateSettings('embedding_provider', e.target.value)} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                {visibleProviders.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Modelo</label>
              <select value={settings.embedding_model} onChange={(e) => void handleUpdateSettings('embedding_model', e.target.value)} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                {(availableModels[settings.embedding_provider] ?? []).map((m) => (
                  <option key={m.model} value={m.model}>{m.model} ({m.dimensions}d)</option>
                ))}
              </select>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                ⚠ Cambiar el modelo requiere re-indexar los documentos existentes (elimínalos y vuelve a subirlos).
              </p>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: 20 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>💬 Chat LLM</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Proveedor</label>
              <select value={settings.chat_provider} onChange={(e) => void handleUpdateSettings('chat_provider', e.target.value)} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }}>
                <option value="openai">OpenAI</option>
              </select>
              <label style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Modelo</label>
              <input type="text" value={settings.chat_model} onChange={(e) => void handleUpdateSettings('chat_model', e.target.value)} style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)' }} />
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0 }}>
                Ejemplos: gpt-4o, gpt-4o-mini
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
