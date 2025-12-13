
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
import { NetworkMessageParser, NetworkMessageHandler } from '../../src/demo/parser.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { DemoStream } from '../../src/demo/demoStream.js';
import * as fs from 'fs';
import * as path from 'path';

// Helper to read file as ArrayBuffer
const readFileAsArrayBuffer = (filePath: string): ArrayBuffer => {
  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

// ConfigString Indices from q_shared.h / configstrings.ts
const CS_MODELS = ConfigStringIndex.Models;
const CS_SOUNDS = ConfigStringIndex.Sounds;
const CS_IMAGES = ConfigStringIndex.Images;

describe('PAK0 Integration Test', () => {
  let vfs: VirtualFileSystem;
  let pak0: PakArchive;

  // Resolve PAK paths relative to this test file for robustness
  // This handles running tests from root or package dir
  const resolvePakPath = (filename: string): string | null => {
      // Try traversing up from __dirname
      let searchDir = __dirname;
      for (let i = 0; i < 5; i++) {
          const p = path.join(searchDir, filename);
          if (fs.existsSync(p)) return p;
          searchDir = path.join(searchDir, '..');
      }
      return null;
  };

  beforeAll(() => {
    const archives: PakArchive[] = [];
    const pak0Path = resolvePakPath('pak0.pak');
    const pakPath = resolvePakPath('pak.pak');

    if (pak0Path) {
        console.log(`Loading pak0.pak from ${pak0Path}`);
        const buffer = readFileAsArrayBuffer(pak0Path);
        pak0 = PakArchive.fromArrayBuffer('pak0.pak', buffer);
        archives.push(pak0);
    } else {
        console.warn('pak0.pak not found! Test will likely fail or skip.');
    }

    if (pakPath) {
        console.log(`Loading pak.pak from ${pakPath}`);
        const buffer = readFileAsArrayBuffer(pakPath);
        archives.push(PakArchive.fromArrayBuffer('pak.pak', buffer));
    }

    vfs = new VirtualFileSystem(archives);
  });

  it('should parse all files in pak0.pak correctly and verify resource dependencies', async () => {
    if (!pak0) {
      console.warn('PAK0 not loaded, skipping test.');
      return;
    }

    const unsupportedFiles: string[] = [];
    const entries = pak0.listEntries();
    console.log(`Found ${entries.length} entries in PAK0.`);

    // Store unique missing resources to avoid duplicates
    const missingResources = new Set<string>();

    const checkResource = (resourcePath: string) => {
        if (!resourcePath || resourcePath.startsWith('*') || resourcePath.startsWith('#')) return;

        // Handle common special texture names in Q2
        const specialTextures = ['skip', 'hint', 'null', 'clip', 'sky', 'origin', 'trigger', 'noclip'];
        if (specialTextures.includes(resourcePath.toLowerCase())) return;

        // Try exact match first
        if (vfs.hasFile(resourcePath)) return;

        // Try with extensions if missing
        const extensions = ['.wal', '.pcx', '.tga', '.sp2', '.md2', '.wav'];
        for (const ext of extensions) {
            if (vfs.hasFile(resourcePath + ext)) return;
        }

        // Texture paths in BSPs are often without extension and expect .wal
        if (!path.extname(resourcePath)) {
             if (vfs.hasFile(`textures/${resourcePath}.wal`)) return;
             if (vfs.hasFile(`textures/${resourcePath}.pcx`)) return;
             if (vfs.hasFile(`${resourcePath}.wal`)) return;
        }

        missingResources.add(resourcePath);
    };

    for (const entry of entries) {
      const ext = path.extname(entry.name).toLowerCase();

      const getBuffer = () => {
          const fileData = pak0.readFile(entry.name);
          return fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength) as ArrayBuffer;
      };

      try {
        switch (ext) {
          case '.bsp': {
            const bsp = parseBsp(getBuffer());
            expect(bsp.header.version).toBe(38);

            // Verify textures
            for (const texInfo of bsp.texInfo) {
                if (texInfo.texture) {
                    checkResource(texInfo.texture);
                }
            }
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
            const wal = parseWal(getBuffer());
            expect(wal.width).toBeGreaterThan(0);
            expect(wal.height).toBeGreaterThan(0);
            break;
          }
          case '.pcx': {
            const pcx = parsePcx(getBuffer());
            expect(pcx.width).toBeGreaterThan(0);
            expect(pcx.height).toBeGreaterThan(0);
            break;
          }
          case '.wav': {
            const wav = parseWav(getBuffer());
            expect(wav.channels).toBeGreaterThan(0);
            expect(wav.sampleRate).toBeGreaterThan(0);
            break;
          }
          case '.ogg': {
            await decodeOgg(getBuffer());
            break;
          }
          case '.dm2': {
            const buffer = getBuffer();
            const demoStream = new DemoStream(buffer);
            demoStream.loadComplete();

            // Handler intercepts configstrings to check resources.
            // It does NOT throw on missing resources, allowing the parser
            // to continue "playing" the demo as much as possible.
            const handler: NetworkMessageHandler = {
                onServerData: (v, s, a, g, p, levelName) => {
                     if (levelName) {
                         // Maps are typically "maps/name.bsp"
                         checkResource(`maps/${levelName}.bsp`);
                     }
                },
                onConfigString: (index, str) => {
                    if (!str) return;
                    if (index >= CS_MODELS && index < CS_SOUNDS) {
                        checkResource(str);
                    } else if (index >= CS_SOUNDS && index < CS_IMAGES) {
                        checkResource(str);
                    } else if (index >= CS_IMAGES && index < CS_IMAGES + 512) { // 512 is MAX_IMAGES
                        checkResource(str);
                    }
                },
                // Stub other methods to avoid crashes
                onSpawnBaseline: () => {},
                onFrame: () => {},
                onCenterPrint: () => {},
                onStuffText: () => {},
                onPrint: () => {},
                onSound: () => {},
                onTempEntity: () => {},
                onLayout: () => {},
                onInventory: () => {},
                onMuzzleFlash: () => {},
                onMuzzleFlash2: () => {},
                onDisconnect: () => {},
                onReconnect: () => {},
                onDownload: () => {}
            };

            const parser = new NetworkMessageParser(demoStream.getBuffer(), handler);
            parser.parseMessage();
            break;
          }
          case '.cfg':
          case '.txt':
          case '.lst':
          case '.rc':
          case '.faq':
          case '.log':
             // Text files
             const text = new TextDecoder().decode(getBuffer());
             expect(text.length).toBeGreaterThanOrEqual(0);
             break;
          case '.tga':
          case '.jpg':
          case '.png':
          case '.cin': // Video files
          case '.dat': // General data
          case '.ico': // Icons
          case '.lit': // Lighting data (often external)
             // Generic binary validation
             expect(getBuffer().byteLength).toBeGreaterThan(0);
             break;

          default:
            console.warn(`Skipping validation for known but unhandled extension: ${ext} in ${entry.name}`);
            break;
        }
      } catch (e) {
        throw new Error(`Failed to parse ${entry.name}: ${(e as Error).message}`);
      }
    }

    // "just store set of missing resources and check against pak contents they are truly missing"
    if (missingResources.size > 0) {
        console.warn(`Demo/Map referenced ${missingResources.size} missing resources.`);

        // Verify that these resources are indeed NOT in the PAK file.
        // This is a sanity check for our resource checking logic.
        const pakFiles = new Set(pak0.listEntries().map(e => e.name.toLowerCase()));

        for (const missing of missingResources) {
            // Note: Our checkResource is smarter (tries extensions), so simple "has" check might fail if exact match.
            // But we already determined they are missing from VFS (which includes pak0).
            // We just double check against pakFiles logic here to be sure.
            const lowerMissing = missing.toLowerCase();

            // If the exact filename exists in the PAK, then our checkResource logic might be flawed
            if (pakFiles.has(lowerMissing)) {
                console.error(`Logic Error: Resource ${missing} was marked missing but exists in PAK0!`);
                // This SHOULD fail the test as it indicates a bug in the test itself
                expect(pakFiles.has(lowerMissing)).toBe(false);
            }
        }
    }
  });
});
