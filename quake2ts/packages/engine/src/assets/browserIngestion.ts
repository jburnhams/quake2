import { ingestPaks, type PakIngestionOptions, type PakIngestionResult, type PakSource } from './ingestion.js';
import { VirtualFileSystem } from './vfs.js';

function toArray(files: Iterable<File>): File[] {
  return Array.isArray(files) ? files : Array.from(files);
}

export function filesToPakSources(files: Iterable<File>): PakSource[] {
  return toArray(files).map((file) => ({ name: file.name, data: file }));
}

export async function ingestPakFiles(
  vfs: VirtualFileSystem,
  files: Iterable<File>,
  options?: PakIngestionOptions,
): Promise<PakIngestionResult[]> {
  const sources = filesToPakSources(files);
  return ingestPaks(vfs, sources, options ?? {});
}

export function wireDropTarget(
  element: HTMLElement,
  handler: (files: File[]) => void,
): () => void {
  const onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.dataTransfer?.dropEffect && (event.dataTransfer.dropEffect = 'copy');
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const droppedFiles = event.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length > 0) {
      handler(Array.from(droppedFiles));
    }
  };

  element.addEventListener('dragover', onDragOver);
  element.addEventListener('drop', onDrop);

  return () => {
    element.removeEventListener('dragover', onDragOver);
    element.removeEventListener('drop', onDrop);
  };
}

export function wireFileInput(
  input: HTMLInputElement,
  handler: (files: FileList) => void,
): () => void {
  const onChange = (event: Event) => {
    const target = event.target as HTMLInputElement | null;
    if (!target || !target.files || target.files.length === 0) {
      return;
    }
    handler(target.files);
    target.value = '';
  };

  input.addEventListener('change', onChange);
  return () => input.removeEventListener('change', onChange);
}
