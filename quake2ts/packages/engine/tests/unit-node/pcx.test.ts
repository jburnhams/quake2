import { describe, expect, it } from 'vitest';
import { parsePcx, pcxToRgba, PcxParseError } from '@quake2ts/engine/assets/pcx.js';
import { buildPcx } from '@quake2ts/test-utils'; // pcxBuilder.js';

describe('PCX loader', () => {
  it('decodes RLE image data and palette to RGBA', () => {
    const buffer = buildPcx({ width: 2, height: 2, pixels: [1, 2, 3, 255] });
    const image = parsePcx(buffer);
    expect(image.width).toBe(2);
    expect(image.pixels[3]).toBe(255);
    const rgba = pcxToRgba(image);
    expect(rgba[0]).toBe(1);
    expect(rgba[15]).toBe(0); // transparent for index 255
  });

  it('rejects invalid headers and missing palettes', () => {
    const buffer = buildPcx({ width: 1, height: 1, pixels: [0] });
    const bad = new Uint8Array(buffer.slice(0));
    bad[0] = 0xff;
    expect(() => parsePcx(bad.buffer)).toThrow(PcxParseError);
  });
});
