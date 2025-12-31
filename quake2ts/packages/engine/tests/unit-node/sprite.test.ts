import { describe, it, expect } from 'vitest';
import { parseSprite, SpriteParseError } from '@quake2ts/engine/assets/sprite.js';

const IDSPRITEHEADER = 0x32534449; // 'IDS2' (Little Endian)
const SPRITE_VERSION = 2;
const MAX_SKINNAME = 64;

function writeString(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
  view.setUint8(offset + text.length, 0);
}

describe('parseSprite', () => {
  it('should parse a valid sprite file with one frame', () => {
    const headerSize = 12;
    const frameSize = 80; // 16 (ints) + 64 (name)
    const buffer = new ArrayBuffer(headerSize + frameSize);
    const view = new DataView(buffer);

    // Header
    view.setInt32(0, IDSPRITEHEADER, true);
    view.setInt32(4, SPRITE_VERSION, true);
    view.setInt32(8, 1, true); // numFrames

    // Frame 1
    view.setInt32(12, 32, true); // width
    view.setInt32(16, 32, true); // height
    view.setInt32(20, -16, true); // originX
    view.setInt32(24, -16, true); // originY
    writeString(view, 28, 'sprites/test.pcx');

    const result = parseSprite(buffer);

    expect(result.ident).toBe(IDSPRITEHEADER);
    expect(result.version).toBe(SPRITE_VERSION);
    expect(result.numFrames).toBe(1);
    expect(result.frames).toHaveLength(1);
    expect(result.frames[0]).toEqual({
      width: 32,
      height: 32,
      originX: -16,
      originY: -16,
      name: 'sprites/test.pcx',
    });
  });

  it('should parse a valid sprite file with multiple frames', () => {
    const numFrames = 3;
    const headerSize = 12;
    const frameSize = 80;
    const buffer = new ArrayBuffer(headerSize + frameSize * numFrames);
    const view = new DataView(buffer);

    // Header
    view.setInt32(0, IDSPRITEHEADER, true);
    view.setInt32(4, SPRITE_VERSION, true);
    view.setInt32(8, numFrames, true);

    for (let i = 0; i < numFrames; i++) {
      const offset = headerSize + i * frameSize;
      view.setInt32(offset, 64, true);
      view.setInt32(offset + 4, 64, true);
      view.setInt32(offset + 8, 10 * i, true);
      view.setInt32(offset + 12, 20 * i, true);
      writeString(view, offset + 16, `frame${i}.pcx`);
    }

    const result = parseSprite(buffer);

    expect(result.numFrames).toBe(3);
    expect(result.frames).toHaveLength(3);
    expect(result.frames[0].name).toBe('frame0.pcx');
    expect(result.frames[1].originX).toBe(10);
    expect(result.frames[2].originY).toBe(40);
  });

  it('should throw on buffer too small for header', () => {
    const buffer = new ArrayBuffer(10);
    expect(() => parseSprite(buffer)).toThrow(SpriteParseError);
    expect(() => parseSprite(buffer)).toThrow('header');
  });

  it('should throw on invalid magic number', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setInt32(0, 0xDEADBEEF, true);
    expect(() => parseSprite(buffer)).toThrow(SpriteParseError);
    expect(() => parseSprite(buffer)).toThrow('ident');
  });

  it('should throw on invalid version', () => {
    const buffer = new ArrayBuffer(12);
    const view = new DataView(buffer);
    view.setInt32(0, IDSPRITEHEADER, true);
    view.setInt32(4, 3, true);
    expect(() => parseSprite(buffer)).toThrow(SpriteParseError);
    expect(() => parseSprite(buffer)).toThrow('version');
  });

  it('should throw if frames exceed buffer length', () => {
    const buffer = new ArrayBuffer(12 + 10); // Header + incomplete frame
    const view = new DataView(buffer);
    view.setInt32(0, IDSPRITEHEADER, true);
    view.setInt32(4, SPRITE_VERSION, true);
    view.setInt32(8, 1, true); // Expecting 1 frame

    expect(() => parseSprite(buffer)).toThrow(SpriteParseError);
    expect(() => parseSprite(buffer)).toThrow('exceeds buffer length');
  });
});
