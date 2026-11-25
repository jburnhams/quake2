export interface PcxImage {
  readonly width: number;
  readonly height: number;
  readonly bitsPerPixel: number;
  readonly pixels: Uint8Array;
  readonly palette: Uint8Array;
}

export class PcxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PcxParseError';
  }
}

export function parsePcx(buffer: ArrayBuffer): PcxImage {
  if (buffer.byteLength < 128) {
    throw new PcxParseError('PCX buffer too small for header');
  }

  const view = new DataView(buffer);
  const manufacturer = view.getUint8(0);
  const encoding = view.getUint8(2);
  const bitsPerPixel = view.getUint8(3);
  const xMin = view.getUint16(4, true);
  const yMin = view.getUint16(6, true);
  const xMax = view.getUint16(8, true);
  const yMax = view.getUint16(10, true);

  if (manufacturer !== 0x0a || encoding !== 1) {
    throw new PcxParseError('Unsupported PCX encoding');
  }
  if (bitsPerPixel !== 8) {
    throw new PcxParseError('Only 8bpp PCX files are supported');
  }

  const width = xMax - xMin + 1;
  const height = yMax - yMin + 1;
  const bytesPerLine = view.getUint16(66, true);

  const paletteMarkerOffset = buffer.byteLength - 769;
  if (paletteMarkerOffset < 128 || new DataView(buffer, paletteMarkerOffset, 1).getUint8(0) !== 0x0c) {
    throw new PcxParseError('Missing PCX palette');
  }

  const palette = new Uint8Array(buffer, paletteMarkerOffset + 1, 768);
  const encoded = new Uint8Array(buffer, 128, paletteMarkerOffset - 128);
  const pixels = new Uint8Array(width * height);

  let srcIndex = 0;
  let dstIndex = 0;

  for (let y = 0; y < height; y += 1) {
    let written = 0;
    while (written < bytesPerLine && srcIndex < encoded.length) {
      let count = 1;
      let value = encoded[srcIndex++]!;

      if ((value & 0xc0) === 0xc0) {
        count = value & 0x3f;
        if (srcIndex >= encoded.length) {
          throw new PcxParseError('Unexpected end of PCX RLE data');
        }
        value = encoded[srcIndex++]!;
      }

      for (let i = 0; i < count && written < bytesPerLine; i += 1) {
        if (written < width) {
          pixels[dstIndex++] = value;
        }
        written += 1;
      }
    }
  }

  return { width, height, bitsPerPixel, pixels, palette };
}

export function pcxToRgba(image: PcxImage): Uint8Array {
  const rgba = new Uint8Array(image.width * image.height * 4);
  for (let i = 0; i < image.pixels.length; i += 1) {
    const colorIndex = image.pixels[i]!;
    const paletteIndex = colorIndex * 3;
    const rgbaIndex = i * 4;
    rgba[rgbaIndex] = image.palette[paletteIndex]!;
    rgba[rgbaIndex + 1] = image.palette[paletteIndex + 1]!;
    rgba[rgbaIndex + 2] = image.palette[paletteIndex + 2]!;
    rgba[rgbaIndex + 3] = colorIndex === 255 ? 0 : 255;
  }
  return rgba;
}
