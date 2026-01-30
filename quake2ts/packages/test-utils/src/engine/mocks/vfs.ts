import { vi } from 'vitest';
import { VirtualFileSystem } from '@quake2ts/engine';

/**
 * Creates a mock VirtualFileSystem.
 *
 * @param overrides - Optional overrides for specific methods.
 * @returns A mocked VirtualFileSystem object.
 */
export function createMockVFS(overrides?: Partial<VirtualFileSystem>): VirtualFileSystem {
  return {
    mountPak: vi.fn(),
    setPriority: vi.fn(),
    getPaks: vi.fn().mockReturnValue([]),
    get mountedPaks() { return []; },
    hasFile: vi.fn().mockReturnValue(false),
    stat: vi.fn().mockReturnValue(undefined),
    getFileMetadata: vi.fn().mockReturnValue(undefined),
    readFile: vi.fn().mockRejectedValue(new Error('File not found (mock)')),
    readBinaryFile: vi.fn().mockRejectedValue(new Error('File not found (mock)')),
    streamFile: vi.fn(),
    readTextFile: vi.fn().mockRejectedValue(new Error('File not found (mock)')),
    list: vi.fn().mockReturnValue({ files: [], directories: [] }),
    listDirectory: vi.fn().mockResolvedValue([]),
    findByExtension: vi.fn().mockReturnValue([]),
    listByExtension: vi.fn().mockReturnValue([]),
    searchFiles: vi.fn().mockReturnValue([]),
    getPakInfo: vi.fn().mockReturnValue([]),
    getDirectoryTree: vi.fn().mockReturnValue({ name: '', path: '', files: [], directories: [] }),
    ...overrides
  } as unknown as VirtualFileSystem;
}
