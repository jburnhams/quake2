export function generateWireframeIndices(indices: Uint16Array | Uint32Array): Uint16Array | Uint32Array {
  const lineIndices: number[] = [];
  // Assumes TRIANGLES primitive
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i];
    const b = indices[i + 1];
    const c = indices[i + 2];
    lineIndices.push(a, b, b, c, c, a);
  }

  // Preserve original type if possible, default to Uint16Array
  if (indices instanceof Uint32Array || Math.max(...lineIndices) > 65535) {
      return new Uint32Array(lineIndices);
  }
  return new Uint16Array(lineIndices);
}
