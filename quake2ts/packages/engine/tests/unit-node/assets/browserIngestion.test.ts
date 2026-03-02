import { describe, expect, it, vi, beforeEach } from 'vitest';
import { VirtualFileSystem } from '../../../src/assets/vfs.js';
import { ingestPakFiles, filesToPakSources, wireDropTarget, wireFileInput } from '../../../src/assets/browserIngestion.js';
import { buildPak, textData } from '@quake2ts/test-utils'; // pakBuilder.js';

const decoder = new TextDecoder();

function createFileList(files: File[]): FileList {
  const fileList: Partial<FileList> = { length: files.length, item: (index: number) => files[index] ?? null };
  files.forEach((file, index) => {
    // @ts-expect-error index assignment for FileList shape
    fileList[index] = file;
  });
  return fileList as FileList;
}

class MockElement {
  listeners: Record<string, Function[]> = {};
  value: string = '';
  type?: string;
  files?: FileList;

  addEventListener(type: string, listener: Function) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: Function) {
    if (this.listeners[type]) {
      this.listeners[type] = this.listeners[type].filter(l => l !== listener);
    }
  }

  dispatchEvent(event: any) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(l => l(event));
    }
  }
}

describe('browser ingestion helpers', () => {
  let vfs: VirtualFileSystem;

  beforeEach(() => {
    vfs = new VirtualFileSystem();
  });

  it('converts File inputs to PakSource objects', () => {
    const pakFile = new File([buildPak([{ path: 'maps/base1.bsp', data: textData('abc') }])], 'pak0.pak');
    const sources = filesToPakSources([pakFile]);

    expect(sources).toEqual([{ name: 'pak0.pak', data: pakFile }]);
  });

  it('ingests browser File instances into the VFS', async () => {
    const pakFile = new File([buildPak([{ path: 'pics/logo.pcx', data: textData('pcx') }])], 'pak0.pak');
    const onProgress = vi.fn();
    const onError = vi.fn();

    const results = await ingestPakFiles(vfs, [pakFile], { onProgress, onError, stopOnError: true });

    expect(results).toHaveLength(1);
    const file = await vfs.readFile('pics/logo.pcx');
    expect(decoder.decode(file)).toBe('pcx');
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ file: 'pak0.pak', state: 'parsed' }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('wires drag and drop to invoke handler with files', () => {
    const handler = vi.fn();
    const element = new MockElement() as unknown as HTMLElement;
    const cleanup = wireDropTarget(element, handler);
    const file = new File(['pak'], 'pak0.pak');

    const dropEvent = {
        type: 'drop',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        dataTransfer: { files: createFileList([file]) }
    } as unknown as DragEvent;

    element.dispatchEvent(dropEvent);
    cleanup();

    expect(handler).toHaveBeenCalledWith([file]);
  });

  it('resets file input value after processing', () => {
    const input = new MockElement() as unknown as HTMLInputElement;
    input.type = 'file';
    const handler = vi.fn();
    const cleanup = wireFileInput(input, handler);

    const file = new File(['pak'], 'pak0.pak');
    Object.defineProperty(input, 'files', { value: createFileList([file]), writable: false });

    const changeEvent = {
        type: 'change',
        target: input,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as Event;

    input.dispatchEvent(changeEvent);
    cleanup();

    expect(handler).toHaveBeenCalledWith(input.files);
    expect(input.value).toBe('');
  });
});
