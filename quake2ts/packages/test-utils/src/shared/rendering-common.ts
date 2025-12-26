/**
 * Creates a checkerboard texture pattern.
 * @param width Texture width
 * @param height Texture height
 * @param cellSize Size of checker cells
 * @param color1 RGBA color for first cell type
 * @param color2 RGBA color for second cell type
 */
export function createCheckerboardTexture(
  width: number,
  height: number,
  cellSize: number,
  color1: [number, number, number, number],
  color2: [number, number, number, number]
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      const isColor1 = (cellX + cellY) % 2 === 0;
      const color = isColor1 ? color1 : color2;

      const idx = (y * width + x) * 4;
      pixels[idx] = color[0];
      pixels[idx + 1] = color[1];
      pixels[idx + 2] = color[2];
      pixels[idx + 3] = color[3];
    }
  }

  return pixels;
}

/**
 * Creates a solid color texture.
 */
export function createSolidColorTexture(
  width: number,
  height: number,
  color: [number, number, number, number]
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4;
    pixels[idx] = color[0];
    pixels[idx + 1] = color[1];
    pixels[idx + 2] = color[2];
    pixels[idx + 3] = color[3];
  }
  return pixels;
}

/**
 * Creates a linear gradient texture (Horizontal: Left=From, Right=To).
 */
export function createGradientTexture(
  width: number,
  height: number,
  from: [number, number, number, number],
  to: [number, number, number, number]
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let x = 0; x < width; x++) {
    const t = x / (width - 1);
    const r = from[0] * (1 - t) + to[0] * t;
    const g = from[1] * (1 - t) + to[1] * t;
    const b = from[2] * (1 - t) + to[2] * t;
    const a = from[3] * (1 - t) + to[3] * t;

    for (let y = 0; y < height; y++) {
        const idx = (y * width + x) * 4;
        pixels[idx] = Math.round(r);
        pixels[idx + 1] = Math.round(g);
        pixels[idx + 2] = Math.round(b);
        pixels[idx + 3] = Math.round(a);
    }
  }

  return pixels;
}

/**
 * Creates a simple quad (2 triangles) vertex buffer data.
 * Returns interleaved [x, y, z, u, v]
 */
export function createQuadVertices(
  x: number, y: number, w: number, h: number, z: number = 0
): Float32Array {
  // TL, BL, TR, BR
  // 0, 1, 2, 2, 1, 3
  return new Float32Array([
    x, y, z, 0, 0,
    x, y + h, z, 0, 1,
    x + w, y, z, 1, 0,
    x + w, y + h, z, 1, 1
  ]);
}
