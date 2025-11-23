import { VertexArray, VertexBuffer, IndexBuffer, Texture2D } from '../resources.js';

export interface BspSurfaceLightmap {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface BspSurfaceInput {
  faceIndex: number;
  textureName: string;
  flags: number;
  vertices: Float32Array; // Interleaved: x, y, z, u, v, lu, lv
  vertexCount: number;
  styles: [number, number, number, number];
  lightmap?: BspSurfaceLightmap;
}

export interface BspBatch {
  textureName: string;
  offset: number;
  count: number;
  flags: number;
  lightmapOffset?: number; // Offset into lightmap atlas if we had one?
  // Actually, BspPipeline has u_lightmapAtlas.
}

export interface BspGeometry {
  vao: VertexArray;
  vbo: VertexBuffer;
  ibo: IndexBuffer;
  indexCount: number;
  batches: BspBatch[];
  lightmapAtlas: Texture2D | null;
}

// Simple shelf packer for lightmaps
class LightmapPacker {
  width: number;
  height: number;
  private x = 0;
  private y = 0;
  private rowHeight = 0;

  // Storing placement info: key -> {x, y, w, h}
  placements = new Map<number, {x: number, y: number, w: number, h: number}>();

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  pack(id: number, w: number, h: number): boolean {
    if (this.x + w > this.width) {
      this.x = 0;
      this.y += this.rowHeight;
      this.rowHeight = 0;
    }

    if (this.y + h > this.height) {
      return false; // Atlas full
    }

    this.placements.set(id, { x: this.x, y: this.y, w, h });
    this.x += w;
    if (h > this.rowHeight) {
      this.rowHeight = h;
    }

    return true;
  }
}

export function buildBspGeometry(gl: WebGL2RenderingContext, surfaces: BspSurfaceInput[]): BspGeometry {
  // 1. Pack Lightmaps
  // We'll use a fixed size atlas for now, say 2048x2048 or 4096.
  // Quake 2 lightmaps are small but there are many.
  const ATLAS_SIZE = 2048;
  const packer = new LightmapPacker(ATLAS_SIZE, ATLAS_SIZE);

  // Collect all surfaces with lightmaps
  const lightmappedSurfaces = surfaces.filter(s => s.lightmap);

  // Sort by height for better packing? (Naive shelf packing doesn't strictly require it but helps)
  lightmappedSurfaces.sort((a, b) => (b.lightmap!.height - a.lightmap!.height));

  const atlasData = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4); // RGBA (alpha unused or 255)
  // Initialize with black/transparent

  for (const surf of lightmappedSurfaces) {
    const lm = surf.lightmap!;
    if (packer.pack(surf.faceIndex, lm.width, lm.height)) {
      const placement = packer.placements.get(surf.faceIndex)!;
      // Copy data to atlas
      // lm.data is RGB (3 bytes)
      for (let ly = 0; ly < lm.height; ly++) {
        for (let lx = 0; lx < lm.width; lx++) {
          const srcIdx = (ly * lm.width + lx) * 3;
          const dstIdx = ((placement.y + ly) * ATLAS_SIZE + (placement.x + lx)) * 4;

          atlasData[dstIdx + 0] = lm.data[srcIdx + 0];
          atlasData[dstIdx + 1] = lm.data[srcIdx + 1];
          atlasData[dstIdx + 2] = lm.data[srcIdx + 2];
          atlasData[dstIdx + 3] = 255;
        }
      }
    } else {
      console.warn(`Failed to pack lightmap for face ${surf.faceIndex}`);
    }
  }

  // 2. Generate Geometry (Vertices & Indices)
  // We need to re-iterate surfaces and update lightmap UVs based on packing.
  // Also triangulate fans.

  const allVertices: number[] = [];
  const allIndices: number[] = [];
  const batches: BspBatch[] = [];

  // Group by texture for batches?
  // Ideally we sort by texture to minimize draw calls, but `renderBsp` might handle sorting.
  // But here we are building a single big buffer.
  // Let's sort surfaces by texture first to create contiguous batches.

  // Note: Modifying the input array order.
  surfaces.sort((a, b) => a.textureName.localeCompare(b.textureName));

  let currentTexture = '';
  let batchStart = 0;
  let batchCount = 0;
  let batchFlags = 0; // Assuming flags match per texture group roughly

  let vertexOffset = 0; // Base vertex index for current surface

  for (const surf of surfaces) {
    if (surf.textureName !== currentTexture) {
      if (batchCount > 0) {
        batches.push({
          textureName: currentTexture,
          offset: batchStart,
          count: batchCount,
          flags: batchFlags
        });
      }
      currentTexture = surf.textureName;
      batchStart = allIndices.length * 2; // Wait, indices are 2 bytes? No, index count.
      batchStart = allIndices.length; // Offset in element count
      batchCount = 0;
      batchFlags = surf.flags;
    } else {
        // Flags check? If flags differ significantly maybe split batch.
        // For Q2, usually texture implies flags.
    }

    // Add Vertices
    const placement = packer.placements.get(surf.faceIndex);
    const hasLightmap = !!placement;

    // Original UVs in vertices are local to face or something?
    // In `createBspSurfaces`, we put:
    // v[5] = l[0] (u)
    // v[6] = l[1] (v)
    // These were normalized to 0..1 relative to the lightmap rect?
    // No, I set them as `(dot(...) / 16) - min`. So they are pixel coordinates relative to lightmap origin (0,0).
    // I need to offset them by placement.x and placement.y, then normalize to atlas size.

    const startV = allVertices.length / 7;

    for (let i = 0; i < surf.vertexCount; i++) {
      const src = surf.vertices;
      const x = src[i*7+0];
      const y = src[i*7+1];
      const z = src[i*7+2];
      const u = src[i*7+3];
      const v = src[i*7+4];
      let lu = src[i*7+5];
      let lv = src[i*7+6];

      if (hasLightmap) {
        // Adjust to atlas position and normalize
        // Add 0.5 to sample center of texel?
        lu = (placement!.x + lu + 0.5) / ATLAS_SIZE;
        lv = (placement!.y + lv + 0.5) / ATLAS_SIZE;
      } else {
          lu = 0; lv = 0;
      }

      allVertices.push(x, y, z, u, v, lu, lv);
    }

    // Add Indices (Triangulate Fan)
    // Vertices 0, 1, 2; 0, 2, 3; ...
    // Vertex indices are relative to `startV`
    for (let i = 2; i < surf.vertexCount; i++) {
        allIndices.push(startV + 0);
        allIndices.push(startV + i - 1);
        allIndices.push(startV + i);
        batchCount += 3;
    }

    vertexOffset += surf.vertexCount;
  }

  // Push last batch
  if (batchCount > 0) {
    batches.push({
      textureName: currentTexture,
      offset: batchStart,
      count: batchCount,
      flags: batchFlags
    });
  }

  // 3. Create GPU Resources
  const vao = new VertexArray(gl);
  const vbo = new VertexBuffer(gl, gl.STATIC_DRAW);
  const ibo = new IndexBuffer(gl, gl.STATIC_DRAW);

  vbo.upload(new Float32Array(allVertices));
  ibo.upload(new Uint32Array(allIndices)); // Or Uint16 if small enough

  // Stride 7 floats = 28 bytes
  // 0: pos (3)
  // 1: tex (2)
  // 2: lm (2)
  vao.configureAttributes([
    { index: 0, size: 3, type: gl.FLOAT, stride: 28, offset: 0 },
    { index: 1, size: 2, type: gl.FLOAT, stride: 28, offset: 12 },
    { index: 2, size: 2, type: gl.FLOAT, stride: 28, offset: 20 },
  ], vbo);

  // Lightmap Texture
  let lmTexture: Texture2D | null = null;
  if (lightmappedSurfaces.length > 0) {
    lmTexture = new Texture2D(gl);
    lmTexture.bind();
    lmTexture.setParameters({
        minFilter: gl.LINEAR,
        magFilter: gl.LINEAR,
        wrapS: gl.CLAMP_TO_EDGE,
        wrapT: gl.CLAMP_TO_EDGE
    });
    lmTexture.upload(ATLAS_SIZE, ATLAS_SIZE, atlasData);
  }

  return {
    vao,
    vbo,
    ibo,
    indexCount: allIndices.length,
    batches,
    lightmapAtlas: lmTexture
  };
}
