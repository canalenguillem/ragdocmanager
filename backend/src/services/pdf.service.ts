import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { TextChunk } from '../types';

const CHUNK_SIZE = 512 * 4;
const CHUNK_OVERLAP = 64 * 4;

interface PageItem {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

type PdfJsModule = {
  getDocument: (source: { data: Uint8Array }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNum: number) => Promise<{
        getViewport: (options: { scale: number }) => { width: number; height: number };
        getTextContent: () => Promise<{
          items: Array<{
            str?: string;
            transform: number[];
            height?: number;
            width?: number;
          }>;
        }>;
      }>;
    }>;
  };
};

const loadPdfJs = new Function(
  'specifier',
  'return import(specifier);'
) as (specifier: string) => Promise<PdfJsModule>;

async function importPdfJs(): Promise<PdfJsModule> {
  const originalGetBuiltinModule = process.getBuiltinModule;

  process.getBuiltinModule = ((name: string) => {
    if (name === 'module') {
      throw new Error('Disabled native canvas loading for pdfjs-dist');
    }

    return originalGetBuiltinModule.call(process, name);
  }) as typeof process.getBuiltinModule;

  try {
    return await loadPdfJs('pdfjs-dist/legacy/build/pdf.mjs');
  } finally {
    process.getBuiltinModule = originalGetBuiltinModule;
  }
}

export async function extractPdfData(filePath: string): Promise<{ chunks: TextChunk[]; pageCount: number }> {
  const pdfjs = await importPdfJs();
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pageCount = pdf.numPages;
  const allItems: PageItem[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const content = await page.getTextContent();

    for (const item of content.items) {
      const text = item.str;
      if (!text?.trim()) {
        continue;
      }

      const tx = item.transform[4];
      const ty = item.transform[5];
      const h = item.height || 12;
      const w = item.width || text.length * 6;

      allItems.push({
        text,
        x: tx / viewport.width,
        y: 1 - (ty + h) / viewport.height,
        width: w / viewport.width,
        height: h / viewport.height,
        page: pageNum
      });
    }
  }

  const chunks = buildChunks(allItems);
  return { chunks, pageCount };
}

function buildChunks(items: PageItem[]): TextChunk[] {
  const chunks: TextChunk[] = [];
  let buffer: PageItem[] = [];
  let charCount = 0;
  let chunkIndex = 0;

  const flush = (): void => {
    if (!buffer.length) {
      return;
    }

    const text = buffer.map((item) => item.text).join(' ').trim();
    const bbox = unionBbox(buffer);
    const dominantPage = buffer[Math.floor(buffer.length / 2)].page;
    chunks.push({ text, page: dominantPage, bbox, chunkIndex, pointId: uuidv4() });
    chunkIndex += 1;

    const overlapStart = buffer.findIndex((_, index) => {
      const charsAfter = buffer.slice(index).reduce((sum, item) => sum + item.text.length, 0);
      return charsAfter <= CHUNK_OVERLAP;
    });

    buffer = overlapStart >= 0 ? buffer.slice(overlapStart) : [];
    charCount = buffer.reduce((sum, item) => sum + item.text.length, 0);
  };

  for (const item of items) {
    buffer.push(item);
    charCount += item.text.length;
    if (charCount >= CHUNK_SIZE) {
      flush();
    }
  }

  flush();
  return chunks;
}

function unionBbox(items: PageItem[]): { x: number; y: number; width: number; height: number } {
  const minX = Math.min(...items.map((item) => item.x));
  const minY = Math.min(...items.map((item) => item.y));
  const maxX = Math.max(...items.map((item) => item.x + item.width));
  const maxY = Math.max(...items.map((item) => item.y + item.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
