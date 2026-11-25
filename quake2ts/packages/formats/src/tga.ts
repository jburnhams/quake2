export interface TgaImage {
  readonly width: number;
  readonly height: number;
  readonly bitsPerPixel: number;
  readonly pixels: Uint8Array;
}

export class TgaParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TgaParseError';
  }
}

/**
 * Parses a TGA image buffer into raw RGBA pixels.
 * Based on original Quake 2 TGA loading in ref_gl/gl_image.c (LoadTGA)
 */
export function parseTga(buffer: ArrayBuffer): TgaImage {
  const view = new DataView(buffer);

  if (buffer.byteLength < 18) {
    throw new TgaParseError('Buffer too small for TGA header');
  }

  // Header parsing
  // See ref_gl/gl_image.c: LoadTGA
  const idLength = view.getUint8(0);
  const colorMapType = view.getUint8(1);
  const imageType = view.getUint8(2);

  // Image spec (starts at offset 8)
  // 8-9: x origin (ignored)
  // 10-11: y origin (ignored)
  const width = view.getUint16(12, true);
  const height = view.getUint16(14, true);
  const pixelDepth = view.getUint8(16);
  const imageDescriptor = view.getUint8(17);

  // Validation
  if (imageType !== 2 && imageType !== 10 && imageType !== 3 && imageType !== 11) {
    throw new TgaParseError(`Unsupported TGA image type: ${imageType} (only RGB/Grayscale supported)`);
  }

  if (pixelDepth !== 24 && pixelDepth !== 32 && pixelDepth !== 8) {
    throw new TgaParseError(`Unsupported pixel depth: ${pixelDepth} (only 8, 24, 32 bpp supported)`);
  }

  const isRle = imageType >= 9;
  const isGrayscale = imageType === 3 || imageType === 11;
  const bytesPerPixel = pixelDepth / 8;

  let offset = 18 + idLength;

  // Skip color map if present
  if (colorMapType === 1) {
    const colorMapLength = view.getUint16(5, true);
    const colorMapEntrySize = view.getUint8(7);
    offset += colorMapLength * (colorMapEntrySize / 8);
  }

  const pixelCount = width * height;
  const pixels = new Uint8Array(pixelCount * 4); // Always output RGBA

  // Pre-calculate origin bit for vertical flip
  // Bit 5 of descriptor: 0 = origin at bottom-left, 1 = top-left
  const originTopLeft = (imageDescriptor & 0x20) !== 0;

  // We decode into a flat RGBA buffer. If origin is bottom-left, we'll need to flip later
  // or write in reverse order. For simplicity, let's decode to a temp buffer then flip if needed.
  // Actually, standard TGA is typically bottom-left (OpenGL style), but Quake textures might vary.
  // Let's decode linearly first.

  let currentPixel = 0;
  const rawData = new Uint8Array(buffer);

  // Helper to read a pixel color
  const readPixel = (outIndex: number) => {
    if (isGrayscale) {
      const gray = rawData[offset++];
      pixels[outIndex] = gray;
      pixels[outIndex + 1] = gray;
      pixels[outIndex + 2] = gray;
      pixels[outIndex + 3] = 255;
    } else {
      const b = rawData[offset++];
      const g = rawData[offset++];
      const r = rawData[offset++];
      const a = pixelDepth === 32 ? rawData[offset++] : 255;

      pixels[outIndex] = r;
      pixels[outIndex + 1] = g;
      pixels[outIndex + 2] = b;
      pixels[outIndex + 3] = a;
    }
  };

  if (!isRle) {
    // Uncompressed - standard pixel reading
    for (let i = 0; i < pixelCount; i++) {
      if (offset >= buffer.byteLength) {
         throw new TgaParseError('Unexpected end of TGA data');
      }
      readPixel(i * 4);
    }
  } else {
    // RLE Compressed
    // See ref_gl/gl_image.c: LoadTGA (RLE handling section)
    let pixelsRead = 0;
    while (pixelsRead < pixelCount) {
      if (offset >= buffer.byteLength) {
        throw new TgaParseError('Unexpected end of TGA RLE data');
      }

      const packetHeader = rawData[offset++];
      const count = (packetHeader & 0x7f) + 1;
      const isRlePacket = (packetHeader & 0x80) !== 0;

      if (pixelsRead + count > pixelCount) {
        throw new TgaParseError('TGA RLE packet exceeds image bounds');
      }

      if (isRlePacket) {
        // Run-length packet: read one pixel value and repeat it
        const r = isGrayscale ? rawData[offset] : rawData[offset + 2];
        const g = isGrayscale ? rawData[offset] : rawData[offset + 1];
        const b = isGrayscale ? rawData[offset] : rawData[offset];
        const a = isGrayscale ? 255 : (pixelDepth === 32 ? rawData[offset + 3] : 255);
        offset += bytesPerPixel;

        for (let i = 0; i < count; i++) {
          const idx = (pixelsRead + i) * 4;
          pixels[idx] = r;
          pixels[idx + 1] = g;
          pixels[idx + 2] = b;
          pixels[idx + 3] = a;
        }
      } else {
        // Raw packet: read 'count' pixels directly
        for (let i = 0; i < count; i++) {
           readPixel((pixelsRead + i) * 4);
        }
      }
      pixelsRead += count;
    }
  }

  // Handle flipping if origin is bottom-left (standard TGA) to match top-left usage usually expected
  // Actually, Quake 2 textures (WAL) are top-left.
  // If the TGA descriptor says bottom-left (bit 5 == 0), we need to flip Y to get top-left.
  if (!originTopLeft) {
    const stride = width * 4;
    const tempRow = new Uint8Array(stride);
    for (let y = 0; y < height / 2; y++) {
      const topRowIdx = y * stride;
      const bottomRowIdx = (height - 1 - y) * stride;

      // Swap rows
      tempRow.set(pixels.subarray(topRowIdx, topRowIdx + stride));
      pixels.set(pixels.subarray(bottomRowIdx, bottomRowIdx + stride), topRowIdx);
      pixels.set(tempRow, bottomRowIdx);
    }
  }

  return {
    width,
    height,
    bitsPerPixel: 32, // We normalized to RGBA
    pixels
  };
}
