import { describe, it, expect } from 'vitest';
import { parseTga, TgaParseError } from '../../src/assets/tga';

describe('TGA Loader', () => {
  it('should throw on empty buffer', () => {
    const buffer = new ArrayBuffer(0);
    expect(() => parseTga(buffer)).toThrow(TgaParseError);
  });

  it('should throw on buffer too small for header', () => {
    const buffer = new ArrayBuffer(17);
    expect(() => parseTga(buffer)).toThrow(TgaParseError);
  });

  it('should parse an uncompressed RGB (24-bit) TGA', () => {
    // 2x2 red image
    const width = 2;
    const height = 2;
    const header = new Uint8Array(18);
    header[2] = 2; // Uncompressed RGB
    header[12] = width & 0xFF; header[13] = (width >> 8) & 0xFF;
    header[14] = height & 0xFF; header[15] = (height >> 8) & 0xFF;
    header[16] = 24; // 24 bpp
    header[17] = 0x20; // Top-left origin

    // BGR format
    const pixels = new Uint8Array([
      0, 0, 255, // Red
      0, 0, 255,
      0, 0, 255,
      0, 0, 255
    ]);

    const buffer = new Uint8Array(header.length + pixels.length);
    buffer.set(header);
    buffer.set(pixels, 18);

    const image = parseTga(buffer.buffer);
    expect(image.width).toBe(2);
    expect(image.height).toBe(2);
    expect(image.bitsPerPixel).toBe(32);
    expect(image.pixels.length).toBe(2 * 2 * 4);

    // Check first pixel (Red, Alpha 255)
    expect(image.pixels[0]).toBe(255); // R
    expect(image.pixels[1]).toBe(0);   // G
    expect(image.pixels[2]).toBe(0);   // B
    expect(image.pixels[3]).toBe(255); // A
  });

  it('should parse an uncompressed RGBA (32-bit) TGA', () => {
    // 1x1 transparent red
    const width = 1;
    const height = 1;
    const header = new Uint8Array(18);
    header[2] = 2; // Uncompressed RGB
    header[12] = width & 0xFF;
    header[14] = height & 0xFF;
    header[16] = 32; // 32 bpp
    header[17] = 0x20; // Top-left origin

    // BGRA format
    const pixels = new Uint8Array([
      0, 0, 255, 128 // Red with 50% alpha
    ]);

    const buffer = new Uint8Array(header.length + pixels.length);
    buffer.set(header);
    buffer.set(pixels, 18);

    const image = parseTga(buffer.buffer);
    expect(image.pixels[0]).toBe(255); // R
    expect(image.pixels[3]).toBe(128); // A
  });

  it('should parse RLE compressed RGB TGA', () => {
    // 4x1 image: 2 red pixels, 2 blue pixels
    const width = 4;
    const height = 1;
    const header = new Uint8Array(18);
    header[2] = 10; // RLE RGB
    header[12] = width & 0xFF;
    header[14] = height & 0xFF;
    header[16] = 24; // 24 bpp
    header[17] = 0x20; // Top-left

    const rleData = [
      // Packet 1: Run length 2 of Red
      // Header: 128 + (2-1) = 129 -> 0x81
      0x81,
      0, 0, 255, // Red (BGR)

      // Packet 2: Raw run of 2 Blue pixels
      // Header: (2-1) = 1 -> 0x01
      0x01,
      255, 0, 0, // Blue 1
      255, 0, 0  // Blue 2
    ];

    const buffer = new Uint8Array(header.length + rleData.length);
    buffer.set(header);
    buffer.set(new Uint8Array(rleData), 18);

    const image = parseTga(buffer.buffer);

    // Pixel 0 (Red)
    expect(image.pixels[0]).toBe(255);
    expect(image.pixels[2]).toBe(0);

    // Pixel 1 (Red)
    expect(image.pixels[4]).toBe(255);
    expect(image.pixels[6]).toBe(0);

    // Pixel 2 (Blue)
    expect(image.pixels[8]).toBe(0);
    expect(image.pixels[10]).toBe(255);

     // Pixel 3 (Blue)
    expect(image.pixels[12]).toBe(0);
    expect(image.pixels[14]).toBe(255);
  });

  it('should handle bottom-left origin by flipping', () => {
    // 1x2 image: Red on top, Blue on bottom visually.
    // Stored as: Blue first, Red second because bottom-left origin.
    const width = 1;
    const height = 2;
    const header = new Uint8Array(18);
    header[2] = 2; // Uncompressed RGB
    header[12] = width & 0xFF;
    header[14] = height & 0xFF;
    header[16] = 24;
    header[17] = 0x00; // Bottom-left origin (default 0)

    const pixels = new Uint8Array([
      255, 0, 0, // Blue (stored first, so bottom row)
      0, 0, 255  // Red (stored second, so top row)
    ]);

    const buffer = new Uint8Array(header.length + pixels.length);
    buffer.set(header);
    buffer.set(pixels, 18);

    const image = parseTga(buffer.buffer);

    // Top pixel (index 0) should be Red
    expect(image.pixels[0]).toBe(255); // R
    expect(image.pixels[2]).toBe(0);   // B

    // Bottom pixel (index 1) should be Blue
    expect(image.pixels[4]).toBe(0);   // R
    expect(image.pixels[6]).toBe(255); // B
  });

  it('should parse 8-bit grayscale TGA', () => {
    // 2x1 grayscale: 0 (black), 255 (white)
    const width = 2;
    const height = 1;
    const header = new Uint8Array(18);
    header[2] = 3; // Uncompressed Grayscale
    header[12] = width & 0xFF;
    header[14] = height & 0xFF;
    header[16] = 8; // 8 bpp
    header[17] = 0x20; // Top-left

    const pixels = new Uint8Array([0, 255]);

    const buffer = new Uint8Array(header.length + pixels.length);
    buffer.set(header);
    buffer.set(pixels, 18);

    const image = parseTga(buffer.buffer);
    expect(image.bitsPerPixel).toBe(32); // Always promotes to RGBA

    // Pixel 0: Black
    expect(image.pixels[0]).toBe(0);
    expect(image.pixels[1]).toBe(0);
    expect(image.pixels[2]).toBe(0);
    expect(image.pixels[3]).toBe(255);

    // Pixel 1: White
    expect(image.pixels[4]).toBe(255);
    expect(image.pixels[5]).toBe(255);
    expect(image.pixels[6]).toBe(255);
    expect(image.pixels[7]).toBe(255);
  });

  it('should parse 8-bit RLE grayscale TGA', () => {
    // 3x1 grayscale: 2x 128 (gray), 1x 255 (white)
    const width = 3;
    const height = 1;
    const header = new Uint8Array(18);
    header[2] = 11; // RLE Grayscale
    header[12] = width & 0xFF;
    header[14] = height & 0xFF;
    header[16] = 8; // 8 bpp
    header[17] = 0x20; // Top-left

    const rleData = [
      // Packet 1: Run length 2 of value 128
      // Header: 128 + (2-1) = 129 -> 0x81
      0x81,
      128,

      // Packet 2: Raw run of 1 value 255
      // Header: (1-1) = 0 -> 0x00
      0x00,
      255
    ];

    const buffer = new Uint8Array(header.length + rleData.length);
    buffer.set(header);
    buffer.set(new Uint8Array(rleData), 18);

    const image = parseTga(buffer.buffer);

    // Pixel 0: Gray
    expect(image.pixels[0]).toBe(128);

    // Pixel 1: Gray
    expect(image.pixels[4]).toBe(128);

    // Pixel 2: White
    expect(image.pixels[8]).toBe(255);
  });
});
