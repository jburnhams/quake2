import { describe, expect, it } from 'vitest';
import { PakArchive, PakParseError, calculatePakChecksum } from '../../src/assets/pak.js';
import { buildPak, textData, createTestPakArchive } from '@quake2ts/test-utils';

describe('PakArchive', () => {
  it('parses valid pak and reads files', () => {
    const pak = createTestPakArchive([
      { path: 'maps/base1.bsp', data: textData('bsp data') },
      { path: 'textures/wall.wal', data: textData('wal') },
    ], 'base.pak');

    expect(pak.listEntries()).toHaveLength(2);
    expect(new TextDecoder().decode(pak.readFile('maps/base1.bsp'))).toBe('bsp data');
  });

  it('normalizes case and deduplicates entries', () => {
    const pak = createTestPakArchive([
      { path: 'textures/sky.WAL', data: textData('first') },
      { path: 'Textures/sky.wal', data: textData('second') },
    ], 'base.pak');

    expect(pak.listEntries()).toHaveLength(1);
    expect(new TextDecoder().decode(pak.readFile('TEXTURES/SKY.wal'))).toBe('second');
  });

  it('throws on invalid magic', () => {
    const pakBuffer = buildPak([{ path: 'file.txt', data: textData('ok') }]);
    const bytes = new Uint8Array(pakBuffer);
    bytes[0] = 0x00;
    expect(() => PakArchive.fromArrayBuffer('bad', pakBuffer)).toThrow(PakParseError);
  });

  it('validates entry bounds', () => {
    const pakBuffer = buildPak([{ path: 'a.txt', data: textData('data') }]);
    const view = new DataView(pakBuffer);
    const headerSize = 12;
    // const directoryEntrySize = 64; // Unused
    const dirOffset = view.getInt32(4, true);
    // Corrupt first entry length
    view.setInt32(dirOffset + 60, 9999, true);
    expect(() => PakArchive.fromArrayBuffer('bad', pakBuffer)).toThrow(PakParseError);
  });

  it('computes checksum for validation', () => {
    const pakBuffer = buildPak([{ path: 'sound.wav', data: textData('boom') }]);
    const checksum = calculatePakChecksum(pakBuffer);
    const archive = PakArchive.fromArrayBuffer('base.pak', pakBuffer);
    expect(archive.validate().checksum).toBe(checksum);
  });
});
