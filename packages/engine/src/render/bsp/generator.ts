import { BspSurfaceInput, BspBatch } from '../bsp/geometry.js';

// Simple shelf packer for lightmaps - Extracted for reuse
export class LightmapPacker {
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

export interface BspGeometryData {
  vertices: Float32Array; // Stride 8
  indices: Uint32Array;
  batches: BspBatch[];
  lightmapAtlas: Uint8Array | null;
  atlasSize: number;
}

export function generateBspGeometryData(
  surfaces: BspSurfaceInput[],
  hiddenClassnames?: Set<string>,
  mapModels?: any[] // Optional: to filter faces by hidden classnames
): BspGeometryData {

  // 1. Filter surfaces based on hidden classnames
  let filteredSurfaces = surfaces;

  if (mapModels && hiddenClassnames && hiddenClassnames.size > 0) {
     // This logic requires access to map entities and models to identify faces.
     // Assuming 'surfaces' input is already filtered or we skip filtering here if data not provided.
     // For now, let's assume the caller filters or passes filtered surfaces.
     // If we really need logic here, we need the BspMap structure.
  }

  // 2. Pack Lightmaps
  const ATLAS_SIZE = 2048;
  const packer = new LightmapPacker(ATLAS_SIZE, ATLAS_SIZE);

  // Collect all surfaces with lightmaps
  const lightmappedSurfaces = filteredSurfaces.filter((s) => s.lightmap);

  // Sort by height for better packing
  lightmappedSurfaces.sort((a, b) => {
    // Estimate total height
    const hA = a.lightmap!.data.length / (a.lightmap!.width * 3);
    const hB = b.lightmap!.data.length / (b.lightmap!.width * 3);
    return hB - hA;
  });

  const atlasData = new Uint8Array(ATLAS_SIZE * ATLAS_SIZE * 4); // RGBA (alpha unused or 255)
  // Initialize with black/transparent (already 0)

  for (const surf of lightmappedSurfaces) {
    const lm = surf.lightmap!;
    // Calculate total height needed for all styles
    const totalHeight = lm.data.length / (lm.width * 3);

    if (packer.pack(surf.faceIndex, lm.width, totalHeight)) {
      const placement = packer.placements.get(surf.faceIndex)!;
      // Copy data to atlas
      // lm.data is RGB (3 bytes)
      for (let ly = 0; ly < totalHeight; ly++) {
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

  // 3. Generate Geometry (Vertices & Indices)
  const allVertices: number[] = [];
  const allIndices: number[] = [];
  const batches: BspBatch[] = [];

  // Group by texture AND light styles AND flags for batches
  const surfacesToProcess = [...filteredSurfaces];
  surfacesToProcess.sort((a, b) => {
    const texDiff = a.textureName.localeCompare(b.textureName);
    if (texDiff !== 0) return texDiff;

    // Sort by flags to group warp/trans surfaces
    if (a.flags !== b.flags) return a.flags - b.flags;

    for (let i = 0; i < 4; i++) {
      if (a.styles[i] !== b.styles[i]) return a.styles[i] - b.styles[i];
    }
    return 0;
  });

  let currentTexture = '';
  let currentStyles: number[] = [];
  let batchStart = 0;
  let batchCount = 0;
  let batchFlags = 0;
  let vertexOffset = 0;

  const createBatch = (
      textureName: string,
      offset: number,
      count: number,
      flags: number,
      styles: number[]
  ) => {
       const styleLayers = [-1, -1, -1, -1];
       let layerCounter = 0;
       for (let i=0; i<4; i++) {
           if (styles[i] !== 255) {
               styleLayers[i] = layerCounter;
               layerCounter++;
           }
       }

       batches.push({
          textureName,
          offset,
          count,
          flags,
          styleIndices: [...styles],
          styleLayers
        });
  };

  for (const surf of surfacesToProcess) {
    let newBatch = false;
    if (surf.textureName !== currentTexture) {
      newBatch = true;
    } else if (surf.flags !== batchFlags) {
      newBatch = true;
    } else {
      for (let i = 0; i < 4; i++) {
        if (surf.styles[i] !== currentStyles[i]) {
          newBatch = true;
          break;
        }
      }
    }

    if (newBatch) {
      if (batchCount > 0) {
        createBatch(currentTexture, batchStart, batchCount, batchFlags, currentStyles);
      }
      currentTexture = surf.textureName;
      currentStyles = [...surf.styles];
      batchStart = allIndices.length;
      batchCount = 0;
      batchFlags = surf.flags;
    }

    // Add Vertices
    const placement = packer.placements.get(surf.faceIndex);
    const hasLightmap = !!placement;

    const startV = allVertices.length / 8; // Stride is 8 floats

    for (let i = 0; i < surf.vertexCount; i++) {
      const src = surf.vertices;
      const x = src[i*7+0];
      const y = src[i*7+1];
      const z = src[i*7+2];
      const u = src[i*7+3];
      const v = src[i*7+4];
      let lu = src[i*7+5];
      let lv = src[i*7+6];

      let lStep = 0;

      if (hasLightmap) {
        lu = (placement!.x + lu + 0.5) / ATLAS_SIZE;
        lv = (placement!.y + lv + 0.5) / ATLAS_SIZE;
        lStep = surf.lightmap!.height / ATLAS_SIZE;
      } else {
          lu = 0; lv = 0;
      }

      allVertices.push(x, y, z, u, v, lu, lv, lStep);
    }

    // Add Indices (Triangulate Fan)
    for (let i = 2; i < surf.vertexCount; i++) {
        allIndices.push(startV + 0);
        allIndices.push(startV + i - 1);
        allIndices.push(startV + i);
        batchCount += 3;
    }

    vertexOffset += surf.vertexCount;
  }

  if (batchCount > 0) {
     createBatch(currentTexture, batchStart, batchCount, batchFlags, currentStyles);
  }

  return {
    vertices: new Float32Array(allVertices),
    indices: new Uint32Array(allIndices),
    batches,
    lightmapAtlas: lightmappedSurfaces.length > 0 ? atlasData : null,
    atlasSize: ATLAS_SIZE
  };
}
