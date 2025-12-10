import { BspMap, BspNode, BspLeaf, BspSurface, BspTexture } from '../bsp/bsp';
import { vec3 } from 'gl-matrix';
import { BoundingBox } from '@quake2ts/shared';

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
      const plane = this.bsp.planes[node.planeId];

      const dist = vec3.dot(point, plane.normal) - plane.dist;
      if (dist >= 0) {
        nodeIndex = node.children[0];
      } else {
        nodeIndex = node.children[1];
      }
    }
    return -(nodeIndex + 1);
  }

  getLeafBounds(leafIndex: number): BoundingBox {
    const leaf = this.bsp.leaves[leafIndex];
    return {
      mins: vec3.clone(leaf.mins),
      maxs: vec3.clone(leaf.maxs)
    };
  }

  getLeafCluster(leafIndex: number): number {
    const leaf = this.bsp.leaves[leafIndex];
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
    this.bsp.surfaces.forEach((surf, i) => {
      const texInfo = this.bsp.texInfo[surf.texInfoId];
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

    this.bsp.texInfo.forEach(ti => {
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
