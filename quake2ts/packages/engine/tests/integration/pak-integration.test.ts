
import { describe, it, expect, beforeAll } from 'vitest';
import { PakArchive } from '../../src/assets/pak.js';
import { VirtualFileSystem } from '../../src/assets/vfs.js';
import { parseBsp } from '../../src/assets/bsp.js';
import { Md2Loader } from '../../src/assets/md2.js';
import { Md3Loader } from '../../src/assets/md3.js';
import { SpriteLoader } from '../../src/assets/sprite.js';
import { parseWal } from '../../src/assets/wal.js';
import { parsePcx } from '../../src/assets/pcx.js';
import { parseWav } from '../../src/assets/wav.js';
import { decodeOgg } from '../../src/assets/ogg.js';
import { DemoReader } from '../../src/demo/demoReader.js';
import { NetworkMessageParser } from '../../src/demo/parser.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to read file as ArrayBuffer
const readFileAsArrayBuffer = (filePath: string): ArrayBuffer => {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

describe('PAK Integration Test', () => {
  let pak: PakArchive;
  let vfs: VirtualFileSystem;
  // Assuming running from packages/engine
  let pakPath = path.resolve(process.cwd(), '../../pak.pak');

  beforeAll(() => {
    console.log('CWD:', process.cwd());
    console.log('Target PAK Path:', pakPath);

    if (!fs.existsSync(pakPath)) {
        // Fallback: try relative to __dirname just in case
        const altPath = path.resolve(__dirname, '../../../../pak.pak');
        console.log('Trying alt path:', altPath);
        if (fs.existsSync(altPath)) {
            pakPath = altPath;
        } else {
            console.warn(`PAK file not found at ${pakPath} or ${altPath}. Skipping tests.`);
            return;
        }
    }

    const buffer = readFileAsArrayBuffer(pakPath);
    pak = PakArchive.fromArrayBuffer('pak.pak', buffer);
    vfs = new VirtualFileSystem([pak]);
  });

  it('should parse all files in pak.pak correctly', async () => {
    if (!pak) {
      console.warn('PAK not loaded, skipping test.');
      return;
    }

    const unsupportedFiles: string[] = [];
    const entries = pak.listEntries();
    console.log(`Found ${entries.length} entries in PAK.`);

    for (const entry of entries) {
      const ext = path.extname(entry.name).toLowerCase();
      const fileData = pak.readFile(entry.name);
      const buffer = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength) as ArrayBuffer;

      try {
        switch (ext) {
          case '.bsp': {
            const bsp = parseBsp(buffer);
            expect(bsp.header.version).toBe(38);
            expect(bsp.header.lumps.size).toBeGreaterThan(0);
            break;
          }
          case '.md2': {
            const loader = new Md2Loader(vfs);
            await loader.load(entry.name);
            break;
          }
          case '.md3': {
            const loader = new Md3Loader(vfs);
            await loader.load(entry.name);
            break;
          }
          case '.sp2': {
            const loader = new SpriteLoader(vfs);
            await loader.load(entry.name);
            break;
          }
          case '.wal': {
            const wal = parseWal(buffer);
            expect(wal.width).toBeGreaterThan(0);
            expect(wal.height).toBeGreaterThan(0);
            break;
          }
          case '.pcx': {
            const pcx = parsePcx(buffer);
            expect(pcx.width).toBeGreaterThan(0);
            expect(pcx.height).toBeGreaterThan(0);
            break;
          }
          case '.wav': {
            const wav = parseWav(buffer);
            expect(wav.channels).toBeGreaterThan(0);
            expect(wav.sampleRate).toBeGreaterThan(0);
            break;
          }
          case '.ogg': {
            await decodeOgg(buffer);
            break;
          }
          case '.dm2': {
            const reader = new DemoReader(buffer);
            let blockCount = 0;
            while (reader.hasMore()) {
              const block = reader.readNextBlock();
              if (!block) break;
              blockCount++;
              const parser = new NetworkMessageParser(block.data);
              parser.parseMessage();
            }
            expect(blockCount).toBeGreaterThan(0);
            break;
          }
          case '.cfg':
          case '.txt':
          case '.lst':
          case '.rc':
             const text = new TextDecoder().decode(fileData);
             expect(text.length).toBeGreaterThanOrEqual(0);
             break;

          default:
            unsupportedFiles.push(entry.name);
            break;
        }
      } catch (e) {
        throw new Error(`Failed to parse ${entry.name}: ${(e as Error).message}`);
      }
    }

    if (unsupportedFiles.length > 0) {
      console.error('Unsupported files found:', unsupportedFiles);
      throw new Error(`Found ${unsupportedFiles.length} unsupported files: ${unsupportedFiles.join(', ')}`);
    }
  });
});
