/**
 * Creates a checkerboard texture for testing sampling and filtering.
 */
export function createCheckerboardTexture(
  width: number,
  height: number,
  checkSize: number = 32,
  color1: [number, number, number, number] = [1, 1, 1, 1],
  color2: [number, number, number, number] = [0, 0, 0, 1]
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const isCheck =
        (Math.floor(x / checkSize) + Math.floor(y / checkSize)) % 2 === 0;
      const color = isCheck ? color1 : color2;

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(color[0] * 255);
      data[idx + 1] = Math.round(color[1] * 255);
      data[idx + 2] = Math.round(color[2] * 255);
      data[idx + 3] = Math.round(color[3] * 255);
    }
  }

  return data;
}

/**
 * Creates a solid color texture.
 */
export function createSolidTexture(
  width: number,
  height: number,
  color: [number, number, number, number]
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  const r = Math.round(color[0] * 255);
  const g = Math.round(color[1] * 255);
  const b = Math.round(color[2] * 255);
  const a = Math.round(color[3] * 255);

  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }

  return data;
}
