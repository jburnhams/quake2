import * as fs from 'node:fs';
import * as path from 'node:path';
import { PakArchive } from '@quake2ts/engine/src/assets/pak.js';

export function findPakFile(): string | null {
  const possiblePaths = [
    path.resolve(process.cwd(), 'pak.pak'),
    path.resolve(process.cwd(), '../pak.pak'),
    path.resolve(process.cwd(), '../../pak.pak'),
    path.resolve(process.cwd(), '../../../pak.pak'),
    path.resolve(process.cwd(), 'baseq2/pak.pak'),
    path.resolve('/app/quake2ts/pak.pak'), // Common docker/env path
    // Fallback for when running deeply nested tests
    path.resolve(process.cwd(), 'quake2ts/pak.pak'),
  ];

  return possiblePaths.find(p => fs.existsSync(p)) || null;
}

export function loadMapFromPak(mapName: string): ArrayBuffer | null {
  const pakPath = findPakFile();
  if (!pakPath) {
    console.warn('pak.pak not found');
    return null;
  }

  try {
    const pakBuffer = fs.readFileSync(pakPath);
    // Cast to ArrayBuffer because node Buffer is compatible but types might mismatch
    const arrayBuffer = pakBuffer.buffer.slice(pakBuffer.byteOffset, pakBuffer.byteOffset + pakBuffer.byteLength) as ArrayBuffer;

    const pak = PakArchive.fromArrayBuffer('pak.pak', arrayBuffer);
    const entry = pak.getEntry(mapName);

    if (entry) {
        // PakArchive.readFile returns Uint8Array, we might want ArrayBuffer
        const data = pak.readFile(mapName);
        return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    }
    return null;
  } catch (e) {
    console.error(`Failed to load map ${mapName} from pak:`, e);
    return null;
  }
}
