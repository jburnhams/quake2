import { PakArchive } from './pak.js';
import { VirtualFileSystem } from './vfs.js';

export interface PakSource {
  readonly name: string;
  readonly data: ArrayBuffer | Blob | ArrayBufferView;
}

export interface PakIngestionProgress {
  readonly file: string;
  readonly loadedBytes: number;
  readonly totalBytes: number;
  readonly state: 'reading' | 'parsed' | 'error';
}

export interface PakIngestionResult {
  readonly archive: PakArchive;
  readonly mounted: boolean;
}

export interface PakIngestionOptions {
  readonly onProgress?: (progress: PakIngestionProgress) => void;
  readonly onError?: (file: string, error: unknown) => void;
  /**
   * Whether ingestion should abort when a single PAK fails to parse or mount.
   * Defaults to false to allow partial success in multi-PAK scenarios.
   */
  readonly stopOnError?: boolean;
}

export class PakIngestionError extends Error {
  constructor(readonly file: string, cause: unknown) {
    super(`Failed to ingest PAK: ${file}`);
    this.name = 'PakIngestionError';
    if (cause instanceof Error && cause.stack) {
      this.stack = cause.stack;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this as any).cause = cause;
  }
}

async function readBlobWithProgress(source: Blob, onProgress?: (progress: PakIngestionProgress) => void): Promise<ArrayBuffer> {
  if (typeof source.arrayBuffer === 'function') {
    const buffer = await source.arrayBuffer();
    onProgress?.({ file: 'blob', loadedBytes: buffer.byteLength, totalBytes: buffer.byteLength, state: 'reading' });
    return buffer;
  }

  if (typeof FileReader !== 'undefined') {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error('Unknown FileReader error'));
      reader.onprogress = (event) => {
        onProgress?.({
          file: 'blob',
          loadedBytes: event.loaded,
          totalBytes: event.total || source.size,
          state: 'reading',
        });
      };
      reader.onload = () => {
        const result = reader.result;
        if (result instanceof ArrayBuffer) {
          resolve(result);
        } else {
          reject(new Error('Unexpected FileReader result'));
        }
      };
      reader.readAsArrayBuffer(source);
    });
  }

  if (typeof Response !== 'undefined') {
    const buffer = await new Response(source).arrayBuffer();
    onProgress?.({ file: 'blob', loadedBytes: buffer.byteLength, totalBytes: buffer.byteLength, state: 'reading' });
    return buffer;
  }

  if (typeof source.stream === 'function') {
    const reader = (source.stream() as ReadableStream<Uint8Array>).getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      if (!value) {
        continue;
      }

      const chunk = value as Uint8Array;

      chunks.push(chunk);
      loaded += chunk.byteLength;
      onProgress?.({ file: 'blob', loadedBytes: loaded, totalBytes: source.size, state: 'reading' });
    }

    const result = new Uint8Array(loaded);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result.buffer;
  }

  throw new PakIngestionError('blob', new Error('Unsupported Blob type'));
}

async function toArrayBuffer(source: PakSource, onProgress?: (progress: PakIngestionProgress) => void): Promise<ArrayBuffer> {
  if (source.data instanceof ArrayBuffer) {
    onProgress?.({ file: source.name, loadedBytes: source.data.byteLength, totalBytes: source.data.byteLength, state: 'reading' });
    return source.data;
  }
  if (source.data instanceof Blob) {
    const totalBytes = source.data.size;
    return readBlobWithProgress(source.data, (progress) =>
      onProgress?.({ ...progress, file: source.name, totalBytes }),
    );
  }

  const buffer = source.data.buffer.slice(source.data.byteOffset, source.data.byteOffset + source.data.byteLength) as ArrayBuffer;
  onProgress?.({ file: source.name, loadedBytes: buffer.byteLength, totalBytes: buffer.byteLength, state: 'reading' });
  return buffer;
}

export async function ingestPaks(
  vfs: VirtualFileSystem,
  sources: PakSource[],
  onProgressOrOptions?: PakIngestionOptions | ((progress: PakIngestionProgress) => void),
): Promise<PakIngestionResult[]> {
  const options: PakIngestionOptions =
    typeof onProgressOrOptions === 'function' ? { onProgress: onProgressOrOptions } : onProgressOrOptions ?? {};

  const results: PakIngestionResult[] = [];

  for (const source of sources) {
    try {
      const buffer = await toArrayBuffer(source, options.onProgress);
      const archive = PakArchive.fromArrayBuffer(source.name, buffer);
      vfs.mountPak(archive);
      options.onProgress?.({ file: source.name, loadedBytes: buffer.byteLength, totalBytes: buffer.byteLength, state: 'parsed' });
      results.push({ archive, mounted: true });
    } catch (error) {
      options.onProgress?.({ file: source.name, loadedBytes: 0, totalBytes: 0, state: 'error' });
      options.onError?.(source.name, error);

      if (options.stopOnError) {
        throw new PakIngestionError(source.name, error);
      }
    }
  }

  return results;
}
