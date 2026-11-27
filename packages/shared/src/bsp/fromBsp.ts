/**
 * Builds the collision model (cmodel) from a parsed BSP.
 *
 * Mirrors CM_LoadMap's lump loading in full/qcommon/cmodel.c. Before this
 * existed, the server, the client session, the explorer and several tests each
 * carried their own copy of this conversion. It lives beside the collision code (not in
 * engine) so that the explorer's movement lab can trace against a map it parsed.
 */
import type { BspMap } from '@quake2ts/formats/bsp';
import { buildCollisionModel, type CollisionModel } from './collision.js';

export function collisionModelFromBsp(bsp: BspMap): CollisionModel {
  const leafBrushes: number[] = [];
  const leaves = bsp.leafs.map((leaf, i) => {
    const brushes = bsp.leafLists.leafBrushes[i] ?? [];
    const firstLeafBrush = leafBrushes.length;
    for (const b of brushes) leafBrushes.push(b);
    return {
      contents: leaf.contents,
      cluster: leaf.cluster,
      area: leaf.area,
      firstLeafBrush,
      numLeafBrushes: brushes.length,
    };
  });

  return buildCollisionModel({
    planes: bsp.planes.map((p) => ({
      normal: { x: p.normal[0], y: p.normal[1], z: p.normal[2] },
      dist: p.dist,
      type: p.type,
    })),
    nodes: bsp.nodes.map((n) => ({ planenum: n.planeIndex, children: [n.children[0], n.children[1]] as [number, number] })),
    leaves,
    brushes: bsp.brushes.map((b) => ({ firstSide: b.firstSide, numSides: b.numSides, contents: b.contents })),
    brushSides: bsp.brushSides.map((s) => ({
      planenum: s.planeIndex,
      surfaceFlags: bsp.texInfo[s.texInfo]?.flags ?? 0,
    })),
    leafBrushes,
    // CMod_LoadSubmodels: spread the mins / maxs by a pixel
    bmodels: bsp.models.map((m) => ({
      mins: { x: m.mins[0] - 1, y: m.mins[1] - 1, z: m.mins[2] - 1 },
      maxs: { x: m.maxs[0] + 1, y: m.maxs[1] + 1, z: m.maxs[2] + 1 },
      origin: { x: m.origin[0], y: m.origin[1], z: m.origin[2] },
      headnode: m.headNode,
    })),
    visibility: bsp.visibility
      ? { numClusters: bsp.visibility.numClusters, clusters: bsp.visibility.clusters }
      : undefined,
  });
}
