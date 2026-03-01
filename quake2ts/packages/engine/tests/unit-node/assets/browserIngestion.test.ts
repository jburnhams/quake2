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
    // Use a mocked HTMLElement
    const listeners: Record<string, Function> = {};
    const element = {
      addEventListener: vi.fn((event, cb) => { listeners[event] = cb; }),
      removeEventListener: vi.fn((event, cb) => { delete listeners[event]; }),
      classList: {
        add: vi.fn(),
        remove: vi.fn()
      }
    } as unknown as HTMLElement;

    const cleanup = wireDropTarget(element, handler);
    const file = new File(['pak'], 'pak0.pak');

    const dropEvent = {
        preventDefault: vi.fn(),
        dataTransfer: { files: createFileList([file]) }
    } as unknown as DragEvent;

    listeners['drop'](dropEvent);
    cleanup();

    expect(handler).toHaveBeenCalledWith([file]);
  });

  it('resets file input value after processing', () => {
    // Use a mocked HTMLInputElement
    const listeners: Record<string, Function> = {};
    const input = {
      type: 'file',
      value: 'fakepath',
      addEventListener: vi.fn((event, cb) => { listeners[event] = cb; }),
      removeEventListener: vi.fn((event, cb) => { delete listeners[event]; })
    } as unknown as HTMLInputElement;

    const handler = vi.fn();
    const cleanup = wireFileInput(input, handler);

    const file = new File(['pak'], 'pak0.pak');
    Object.defineProperty(input, 'files', { value: createFileList([file]), writable: false });

    listeners['change']({ target: input });
    cleanup();

    expect(handler).toHaveBeenCalledWith(input.files);
    expect(input.value).toBe('');
  });
});
