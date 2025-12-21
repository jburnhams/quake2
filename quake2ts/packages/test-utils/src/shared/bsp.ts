import {
  computePlaneSignBits,
  type CollisionBrush,
  type CollisionModel,
  type CollisionPlane,
  type CollisionNode,
  type CollisionLeaf,
  CONTENTS_SOLID,
  type Vec3
} from '@quake2ts/shared';

/**
 * Creates a collision plane with the specified normal and distance.
 * Automatically calculates the plane type and signbits.
 *
 * @param normal - The normal vector of the plane.
 * @param dist - The distance from the origin.
 * @returns A CollisionPlane object.
 */
export function makePlane(normal: Vec3, dist: number): CollisionPlane {
  return {
    normal,
    dist,
    type: Math.abs(normal.x) === 1 ? 0 : Math.abs(normal.y) === 1 ? 1 : Math.abs(normal.z) === 1 ? 2 : 3,
    signbits: computePlaneSignBits(normal),
  };
}

/**
 * Creates a simple axis-aligned cubic brush for testing.
 *
 * @param size - The size of the cube (width, height, depth).
 * @param contents - The content flags for the brush (default: CONTENTS_SOLID).
 * @returns A CollisionBrush object.
 */
export function makeAxisBrush(size: number, contents = CONTENTS_SOLID): CollisionBrush {
  const half = size / 2;
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, half),
    makePlane({ x: -1, y: 0, z: 0 }, half),
    makePlane({ x: 0, y: 1, z: 0 }, half),
    makePlane({ x: 0, y: -1, z: 0 }, half),
    makePlane({ x: 0, y: 0, z: 1 }, half),
    makePlane({ x: 0, y: 0, z: -1 }, half),
  ];

  return {
    contents,
    sides: planes.map((plane) => ({ plane, surfaceFlags: 0 })),
  };
}

/**
 * Creates a BSP node.
 *
 * @param plane - The splitting plane for this node.
 * @param children - Indices of the children (positive for nodes, negative for leaves).
 * @returns A CollisionNode object.
 */
export function makeNode(plane: CollisionPlane, children: [number, number]): CollisionNode {
  return { plane, children };
}

/**
 * Constructs a full CollisionModel from components.
 *
 * @param planes - Array of planes.
 * @param nodes - Array of nodes.
 * @param leaves - Array of leaves.
 * @param brushes - Array of brushes.
 * @param leafBrushes - Array of leaf brush indices.
 * @returns A CollisionModel object.
 */
export function makeBspModel(
  planes: CollisionPlane[],
  nodes: CollisionNode[],
  leaves: CollisionLeaf[],
  brushes: CollisionBrush[],
  leafBrushes: number[]
): CollisionModel {
  return {
    planes,
    nodes,
    leaves,
    brushes,
    leafBrushes,
    bmodels: [],
  };
}

/**
 * Creates a BSP leaf.
 *
 * @param contents - The content flags for this leaf.
 * @param firstLeafBrush - Index into the leafBrushes array.
 * @param numLeafBrushes - Number of brushes in this leaf.
 * @returns A CollisionLeaf object.
 */
export function makeLeaf(contents: number, firstLeafBrush: number, numLeafBrushes: number): CollisionLeaf {
  return { contents, cluster: 0, area: 0, firstLeafBrush, numLeafBrushes };
}

/**
 * Creates a simplified CollisionModel consisting of a single leaf containing the provided brushes.
 * Useful for testing collision against a set of brushes without full BSP tree traversal.
 *
 * @param brushes - Array of CollisionBrushes to include.
 * @returns A CollisionModel object.
 */
export function makeLeafModel(brushes: CollisionBrush[]): CollisionModel {
  const planes = brushes.flatMap((brush) => brush.sides.map((side) => side.plane));

  return {
    planes,
    nodes: [],
    leaves: [makeLeaf(0, 0, brushes.length)],
    brushes,
    leafBrushes: brushes.map((_, i) => i),
    bmodels: [],
  };
}

/**
 * Creates a brush defined by min and max bounds.
 *
 * @param mins - Minimum coordinates (x, y, z).
 * @param maxs - Maximum coordinates (x, y, z).
 * @param contents - Content flags (default: CONTENTS_SOLID).
 * @returns A CollisionBrush object.
 */
export function makeBrushFromMinsMaxs(mins: Vec3, maxs: Vec3, contents = CONTENTS_SOLID): CollisionBrush {
  const planes = [
    makePlane({ x: 1, y: 0, z: 0 }, maxs.x),
    makePlane({ x: -1, y: 0, z: 0 }, -mins.x),
    makePlane({ x: 0, y: 1, z: 0 }, maxs.y),
    makePlane({ x: 0, y: -1, z: 0 }, -mins.y),
    makePlane({ x: 0, y: 0, z: 1 }, maxs.z),
    makePlane({ x: 0, y: 0, z: -1 }, -mins.z),
  ];

  return {
    contents,
    sides: planes.map((plane) => ({ plane, surfaceFlags: 0 })),
  };
}
