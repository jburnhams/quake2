import { describe, expect, it } from 'vitest';
import { preparePcxTexture, TextureCache, walToRgba } from '../../src/assets/texture.js';
import { buildPcx } from '@quake2ts/test-utils'; // pcxBuilder.js';
import { buildWal } from '@quake2ts/test-utils'; // walBuilder.js';
import { parsePcx } from '../../src/assets/pcx.js';
import { parseWal } from '../../src/assets/wal.js';

describe('Texture cache and preparation', () => {
  it('converts PCX to RGBA and caches result', () => {
    const pcxBuffer = buildPcx({ width: 1, height: 1, pixels: [5] });
    const texture = preparePcxTexture(parsePcx(pcxBuffer));
    const cache = new TextureCache({ capacity: 2 });
    cache.set('pics/test.pcx', texture);
    expect(cache.get('PICS/TEST.PCX')?.levels[0]?.rgba[0]).toBe(5);
  });

  it('converts WAL mip chain into RGBA levels', () => {
    const palette = new Uint8Array(768);
    palette.fill(0);
    palette[0] = 255;
    const walBuffer = buildWal({ name: 'WALL', width: 2, height: 2 });
    const wal = parseWal(walBuffer);
    const prepared = walToRgba(wal, palette);
    expect(prepared.levels[0]?.rgba[0]).toBe(255);
    expect(prepared.levels).toHaveLength(4);
  });
});
