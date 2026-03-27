import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { api } from '../../api/client';
import { Source } from '../../types';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Props {
  documentId: number;
  targetPage: number;
  highlights: Source['bbox'][];
}

export const PdfViewer: React.FC<Props> = ({ documentId, targetPage, highlights }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackUrlRef = useRef<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [displaySize, setDisplaySize] = useState({ width: 0, height: 0 });
  const [error, setError] = useState('');
  const [fallbackUrl, setFallbackUrl] = useState('');

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setError('');
        setFallbackUrl('');
        setCanvasSize({ width: 0, height: 0 });
        setDisplaySize({ width: 0, height: 0 });
        const response = await api.get<ArrayBuffer>(`/documents/${documentId}/file`, {
          responseType: 'arraybuffer',
          params: { ts: `${documentId}-${targetPage}-${Date.now()}` },
          headers: {
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache'
          }
        });
        const pdfData = new Uint8Array(response.data);
        const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
        if (fallbackUrlRef.current) {
          URL.revokeObjectURL(fallbackUrlRef.current);
        }
        fallbackUrlRef.current = blobUrl;
        const pdf = await pdfjs.getDocument({ data: pdfData }).promise;
        const page = await pdf.getPage(targetPage);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) {
          return;
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        setCanvasSize({ width: viewport.width, height: viewport.height });
        setDisplaySize({ width: viewport.width, height: viewport.height });
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return;
        }

        await page.render({ canvasContext: ctx, viewport }).promise;
      } catch (err) {
        console.error('Failed to load PDF preview', { documentId, targetPage, err });
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error desconocido';
          if (fallbackUrlRef.current) {
            setFallbackUrl(`${fallbackUrlRef.current}#page=${targetPage}`);
            setError(`Vista avanzada no disponible: ${message}`);
          } else {
            setError(`No se pudo cargar el PDF: ${message}`);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      if (fallbackUrlRef.current) {
        URL.revokeObjectURL(fallbackUrlRef.current);
        fallbackUrlRef.current = null;
      }
    };
  }, [documentId, targetPage]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const updateDisplaySize = () => {
      setDisplaySize({
        width: canvas.clientWidth || canvas.width,
        height: canvas.clientHeight || canvas.height
      });
    };

    updateDisplaySize();
    const observer = new ResizeObserver(updateDisplaySize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasSize.width, canvasSize.height]);

  if (fallbackUrl) {
    return (
      <>
        <div className="viewer-error">{error}</div>
        <iframe
          title={`PDF ${documentId}`}
          src={fallbackUrl}
          style={{ width: '100%', height: '100%', border: 0, borderRadius: 12, background: '#fff' }}
        />
      </>
    );
  }

  if (error) {
    return <div className="viewer-error">{error}</div>;
  }

  return (
    <div className="pdf-stage">
      <canvas ref={canvasRef} className="pdf-canvas" />
      <div
        className="pdf-overlay"
        style={{ width: displaySize.width, height: displaySize.height }}
      >
        {highlights.map((bbox, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: bbox.x * displaySize.width,
              top: bbox.y * displaySize.height,
              width: bbox.width * displaySize.width,
              height: bbox.height * displaySize.height,
              background: 'rgba(255, 230, 0, 0.40)',
              border: '2px solid #f59e0b',
              borderRadius: 2
            }}
          />
        ))}
      </div>
    </div>
  );
};
