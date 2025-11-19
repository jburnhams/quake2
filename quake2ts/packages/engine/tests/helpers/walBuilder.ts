interface WalOptions {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly palette?: Uint8Array;
}

export function buildWal(options: WalOptions): ArrayBuffer {
  const { width, height } = options;
  const headerSize = 100;
  const mipSizes = [
    width * height,
    Math.max(1, (width >> 1) * (height >> 1)),
    Math.max(1, (width >> 2) * (height >> 2)),
    Math.max(1, (width >> 3) * (height >> 3)),
  ];
  const totalSize = headerSize + mipSizes.reduce((a, b) => a + b, 0);
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const encoder = new TextEncoder();
  new Uint8Array(buffer, 0, 32).set(encoder.encode(options.name));
  view.setInt32(32, width, true);
  view.setInt32(36, height, true);

  let offset = headerSize;
  mipSizes.forEach((size, index) => {
    view.setInt32(40 + index * 4, offset, true);
    const data = new Uint8Array(buffer, offset, size);
    for (let i = 0; i < size; i += 1) {
      data[i] = (i + index) % 256;
    }
    offset += size;
  });

  new Uint8Array(buffer, 56, 32).set(encoder.encode(options.name + '_anim'));
  view.setInt32(88, 0, true);
  view.setInt32(92, 0, true);
  view.setInt32(96, 0, true);
  return buffer;
}
