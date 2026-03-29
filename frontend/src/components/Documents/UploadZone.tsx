import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import axios from 'axios';
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
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiMessage = typeof error.response?.data?.error === 'string' ? error.response.data.error : '';
        if (error.response?.status === 413) {
          setError(apiMessage || 'El PDF supera el límite máximo de 200 MB');
        } else {
          setError(apiMessage || 'No se pudo subir el PDF');
        }
      } else {
        setError('No se pudo subir el PDF');
      }
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
    <div className="upload-zone-wrap">
      <div
        {...getRootProps()}
        className={`upload-zone ${isDragActive ? 'drag-active' : ''}`}
      >
        <input {...getInputProps()} />
        <div className="upload-zone-icon">
          <UploadCloud size={28} />
        </div>
        <div className="upload-zone-title">Arrastra un PDF o haz clic para subirlo</div>
        <div className="upload-zone-copy">Solo `application/pdf`, máximo 200 MB</div>
      </div>
      {uploading ? (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 10, background: 'var(--bg-secondary)', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progress}%`,
                height: '100%',
                borderRadius: 999,
                background: 'linear-gradient(90deg, var(--accent), #60a5fa)'
              }}
            />
          </div>
        </div>
      ) : null}
      {error ? <div style={{ marginTop: 10, color: 'var(--error)' }}>{error}</div> : null}
    </div>
  );
}
