import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import { api } from '../../api/client';

export function UploadZone({ onUploaded }: { onUploaded: () => Promise<void> }) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setError('');
    setProgress(0);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        }
      });
      await onUploaded();
    } catch {
      setError('No se pudo subir el PDF');
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    onDrop
  });

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 18,
          padding: '28px 20px',
          background: 'var(--bg-card)',
          textAlign: 'center',
          cursor: 'pointer'
        }}
      >
        <input {...getInputProps()} />
        <UploadCloud size={28} style={{ marginBottom: 12 }} />
        <div style={{ fontWeight: 600, marginBottom: 6 }}>Arrastra un PDF o haz clic para subirlo</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Solo `application/pdf`, máximo 50 MB</div>
      </div>
      {uploading ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 999 }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 999,
                background: 'var(--accent)'
              }}
            />
          </div>
        </div>
      ) : null}
      {error ? <div style={{ marginTop: 10, color: 'var(--error)' }}>{error}</div> : null}
    </div>
  );
}
