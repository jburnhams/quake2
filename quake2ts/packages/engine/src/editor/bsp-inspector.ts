import { BspMap } from '../assets/bsp.js';
import { vec3 } from 'gl-matrix';
import { Bounds3 } from '@quake2ts/shared';

export interface BspNodeTree {
  // Representation of the tree structure for visualization
  // Could be simplified or reference actual nodes
  headNodeIndex: number;
}

export interface SurfaceInfo {
  textureName: string;
  lightmapId: number;
  normal: vec3;
  // Other details
}

export interface TextureInfo {
  name: string;
  width: number;
  height: number;
}

export class BspInspector {
  constructor(private bsp: BspMap) {}

  getBspNodeTree(): BspNodeTree {
    return {
      headNodeIndex: 0
    };
  }

  findLeafContainingPoint(point: vec3): number {
    let nodeIndex = 0;
    while (nodeIndex >= 0) {
      const node = this.bsp.nodes[nodeIndex];
      const plane = this.bsp.planes[node.planeIndex];

      // bsp.planes[].normal is [x,y,z] tuple (Vec3 type in bsp.ts), not Float32Array.
      // gl-matrix vec3.dot expects Float32Array or array.
      // We can use direct calculation.
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
    const leaf = this.bsp.leafs[leafIndex];
    // leaf.mins is [number, number, number]
    return {
      mins: { x: leaf.mins[0], y: leaf.mins[1], z: leaf.mins[2] },
      maxs: { x: leaf.maxs[0], y: leaf.maxs[1], z: leaf.maxs[2] }
    };
  }

  getLeafCluster(leafIndex: number): number {
    const leaf = this.bsp.leafs[leafIndex];
    return leaf.cluster;
  }

  isClusterVisible(fromCluster: number, toCluster: number): boolean {
    if (fromCluster === -1 || toCluster === -1) return true; // Usually -1 means always visible or error
    if (fromCluster === toCluster) return true;

    // STUB: This requires PVS data access which involves decompressing the visibility data from the BSP.
    // The current BspMap interface stores raw visibility bytes but does not expose a high-level PVS checker here.
    // In a full implementation, we would use the `vis` offset from `dvis_t` and decompress the bit vector.
    // For now, we assume everything is visible to avoid blocking inspection.
    return true;
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
    // NOTE: This only lists textures referenced in the BSP `texInfo`.
    // It does not reflect actual loaded texture assets (Images/WebTextures) from the Engine/Renderer,
    // so `width` and `height` are unavailable and set to 0.
    // To get full texture metadata, this inspector would need access to the `TextureManager` or `AssetManager`.

    const textures = new Map<string, TextureInfo>();

    this.bsp.texInfo.forEach((ti: any) => {
      if (ti.texture) {
         textures.set(ti.texture, {
           name: ti.texture,
           width: 0, // Not available in basic BSP struct
           height: 0
         });
      }
    });

    return Array.from(textures.values());
  }
}
