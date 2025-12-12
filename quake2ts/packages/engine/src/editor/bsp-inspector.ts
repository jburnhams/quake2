import { BspMap } from '../assets/bsp.js';
import { vec3 } from 'gl-matrix';
import { Bounds3 } from '@quake2ts/shared';
import { TextureCache } from '../assets/texture.js';

export interface BspNodeTree {
  // Representation of the tree structure for visualization
  // Could be simplified or reference actual nodes
  headNodeIndex: number;
}

export interface SurfaceInfo {
  faceIndex: number;
  textureName: string;
  lightmapId: number;
  normal: vec3;
  plane: {
    normal: vec3;
    dist: number;
  };
  vertices: vec3[];
}

export interface TextureInfo {
  name: string;
  width: number;
  height: number;
}

export class BspInspector {
  constructor(private bsp: BspMap, private textureCache?: TextureCache) {}

  getBspNodeTree(): BspNodeTree {
    return {
      headNodeIndex: 0
    };
  }

  findLeafContainingPoint(point: vec3): number {
    let nodeIndex = 0;
    while (nodeIndex >= 0) {
      if (nodeIndex >= this.bsp.nodes.length) return -1;

      const node = this.bsp.nodes[nodeIndex];
      const plane = this.bsp.planes[node.planeIndex];

      // bsp.planes[].normal is [x,y,z] tuple (Vec3 type in bsp.ts), not Float32Array.
      const dot = point[0] * plane.normal[0] + point[1] * plane.normal[1] + point[2] * plane.normal[2];
      const dist = dot - plane.dist;
      if (dist >= 0) {
        nodeIndex = node.children[0];
      } else {
        nodeIndex = node.children[1];
      }
    }
    return -(nodeIndex + 1);
  }

  getLeafBounds(leafIndex: number): Bounds3 {
    if (leafIndex < 0 || leafIndex >= this.bsp.leafs.length) {
        return { mins: { x: 0, y: 0, z: 0 }, maxs: { x: 0, y: 0, z: 0 } };
    }
    const leaf = this.bsp.leafs[leafIndex];
    // leaf.mins is [number, number, number]
    return {
      mins: { x: leaf.mins[0], y: leaf.mins[1], z: leaf.mins[2] },
      maxs: { x: leaf.maxs[0], y: leaf.maxs[1], z: leaf.maxs[2] }
    };
  }

  getLeafCluster(leafIndex: number): number {
    if (leafIndex < 0 || leafIndex >= this.bsp.leafs.length) return -1;
    const leaf = this.bsp.leafs[leafIndex];
    return leaf.cluster;
  }

  isClusterVisible(fromCluster: number, toCluster: number): boolean {
    if (fromCluster === -1 || toCluster === -1) return true; // Usually -1 means always visible or error
    if (fromCluster === toCluster) return true;

    if (!this.bsp.visibility || !this.bsp.visibility.clusters) {
        return true; // No PVS data means no occlusion
    }

    if (fromCluster >= this.bsp.visibility.clusters.length) {
        return true; // Invalid cluster, assume visible
    }

    const clusterData = this.bsp.visibility.clusters[fromCluster];
    if (!clusterData) return true;

    const pvs = clusterData.pvs;
    const byteIndex = toCluster >> 3;
    const bitIndex = 1 << (toCluster & 7);

    if (byteIndex >= pvs.length) return false;

    return (pvs[byteIndex] & bitIndex) !== 0;
  }

  getSurfaceAtPoint(point: vec3): SurfaceInfo | null {
      const leafIndex = this.findLeafContainingPoint(point);
      if (leafIndex < 0 || leafIndex >= this.bsp.leafs.length) return null;

      // Access leaf faces via leafLists
      const faceIndices = this.bsp.leafLists.leafFaces[leafIndex];
      if (!faceIndices) return null;

      const EPSILON = 1.0; // Tolerance for "on surface"

      for (const faceIndex of faceIndices) {
          const face = this.bsp.faces[faceIndex];
          const plane = this.bsp.planes[face.planeIndex];

          // Check distance to plane
          const dot = point[0] * plane.normal[0] + point[1] * plane.normal[1] + point[2] * plane.normal[2];
          const dist = Math.abs(dot - plane.dist);

          if (dist < EPSILON) {
              // Found a candidate face.
              const texInfo = this.bsp.texInfo[face.texInfo];

              // Collect vertices
              const vertices: vec3[] = [];
              for (let i = 0; i < face.numEdges; i++) {
                const edgeIndex = this.bsp.surfEdges[face.firstEdge + i];
                let vIndex: number;
                if (edgeIndex >= 0) {
                    vIndex = this.bsp.edges[edgeIndex].vertices[0];
                } else {
                    vIndex = this.bsp.edges[-edgeIndex].vertices[1];
                }
                const v = this.bsp.vertices[vIndex];
                vertices.push(vec3.fromValues(v[0], v[1], v[2]));
              }

              return {
                  faceIndex,
                  textureName: texInfo ? texInfo.texture : 'unknown',
                  lightmapId: face.styles[0],
                  normal: vec3.fromValues(plane.normal[0], plane.normal[1], plane.normal[2]),
                  plane: {
                    normal: vec3.fromValues(plane.normal[0], plane.normal[1], plane.normal[2]),
                    dist: plane.dist
                  },
                  vertices
              };
          }
      }

      return null;
  }

  getSurfacesByTexture(textureName: string): number[] {
    const indices: number[] = [];
    this.bsp.faces.forEach((face, i) => {
      const texInfo = this.bsp.texInfo[face.texInfo];
      if (texInfo && texInfo.texture === textureName) {
        indices.push(i);
      }
    });
    return indices;
  }

  getAllLoadedTextures(): TextureInfo[] {
    const textures = new Map<string, TextureInfo>();

    this.bsp.texInfo.forEach((ti: any) => {
      if (ti.texture) {
         let width = 0;
         let height = 0;

         if (this.textureCache) {
             const cached = this.textureCache.get(ti.texture);
             if (cached) {
                 width = cached.width;
                 height = cached.height;
             }
         }

         textures.set(ti.texture, {
           name: ti.texture,
           width,
           height
         });
      }
    });

    return Array.from(textures.values());
  }

  getTextureData(name: string): ImageData | null {
      if (!this.textureCache) return null;
      const cached = this.textureCache.get(name);
      if (!cached) return null;

      // Ensure we have a valid width/height
      if (cached.width === 0 || cached.height === 0) return null;

      // Extract level 0 data
      const level0 = cached.levels[0];
      if (!level0) return null;

      const rgba = level0.rgba;
      // Convert to ImageData
      // In browser, ImageData constructor takes (Uint8ClampedArray, width, height)
      // Note: rgba is Uint8Array, needs casting or copying to Uint8ClampedArray

      const clamped = new Uint8ClampedArray(rgba);
      try {
        return new ImageData(clamped, cached.width, cached.height);
      } catch (e) {
        // Fallback or error if environment doesn't support ImageData or has different signature
        // For headless tests (node-canvas), ImageData is available globally usually via polyfill
        return {
            data: clamped,
            width: cached.width,
            height: cached.height,
            colorSpace: 'srgb'
        } as unknown as ImageData;
      }
  }

  getTextureDependencies(mapName: string): string[] {
      // Returns a unique list of texture names referenced by this BSP
      const names = new Set<string>();
      this.bsp.texInfo.forEach(ti => {
          if (ti.texture) {
              names.add(ti.texture);
          }
      });
      return Array.from(names).sort();
  }
}
