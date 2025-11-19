interface PcxOptions {
  readonly width: number;
  readonly height: number;
  readonly pixels: readonly number[];
  readonly palette?: Uint8Array;
}

export function buildPcx(options: PcxOptions): ArrayBuffer {
  const { width, height } = options;
  const headerSize = 128;
  const paletteSize = 769;
  const encodedPixels: number[] = [];
  for (const value of options.pixels) {
    if (value >= 0xc0) {
      encodedPixels.push(0xc1, value);
    } else {
      encodedPixels.push(value);
    }
  }
  const imageSize = encodedPixels.length;
  const buffer = new ArrayBuffer(headerSize + imageSize + paletteSize);
  const view = new DataView(buffer);
  view.setUint8(0, 0x0a); // manufacturer
  view.setUint8(1, 5); // version
  view.setUint8(2, 1); // encoding
  view.setUint8(3, 8); // bits per pixel
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, width - 1, true);
  view.setUint16(10, height - 1, true);
  view.setUint16(66, width, true);

  const encoded = new Uint8Array(buffer, headerSize, imageSize);
  encoded.set(encodedPixels);

  const paletteMarkerOffset = headerSize + imageSize;
  view.setUint8(paletteMarkerOffset, 0x0c);
  const palette = new Uint8Array(buffer, paletteMarkerOffset + 1, 768);
  palette.fill(0);
  if (options.palette) {
    palette.set(options.palette.subarray(0, 768));
  } else {
    for (let i = 0; i < 256; i += 1) {
      palette[i * 3] = i;
      palette[i * 3 + 1] = 255 - i;
      palette[i * 3 + 2] = i;
    }
  }

  return buffer;
}
