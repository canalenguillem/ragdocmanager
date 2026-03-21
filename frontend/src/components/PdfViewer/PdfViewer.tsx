import React, { useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { Source } from '../../types';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface Props {
  documentId: number;
  targetPage: number;
  highlights: Source['bbox'][];
}

export const PdfViewer: React.FC<Props> = ({ documentId, targetPage, highlights }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const url = `/documents/${documentId}/file`;
      const pdf = await pdfjs.getDocument(url).promise;
      const page = await pdf.getPage(targetPage);
      const scale = 1.5;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) {
        return;
      }

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasSize({ width: viewport.width, height: viewport.height });
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return;
      }

      await page.render({ canvasContext: ctx, viewport }).promise;
    })();

    return () => {
      cancelled = true;
    };
  }, [documentId, targetPage]);

  return (
    <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
      <canvas ref={canvasRef} style={{ maxWidth: '100%' }} />
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: canvasSize.width,
          height: canvasSize.height,
          pointerEvents: 'none'
        }}
      >
        {highlights.map((bbox, index) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: bbox.x * canvasSize.width,
              top: bbox.y * canvasSize.height,
              width: bbox.width * canvasSize.width,
              height: bbox.height * canvasSize.height,
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
