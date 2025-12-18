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

export function makePlane(normal: Vec3, dist: number): CollisionPlane {
  return {
    normal,
    dist,
    type: Math.abs(normal.x) === 1 ? 0 : Math.abs(normal.y) === 1 ? 1 : Math.abs(normal.z) === 1 ? 2 : 3,
    signbits: computePlaneSignBits(normal),
  };
}

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

export function makeNode(plane: CollisionPlane, children: [number, number]): CollisionNode {
  return { plane, children };
}

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

export function makeLeaf(contents: number, firstLeafBrush: number, numLeafBrushes: number): CollisionLeaf {
  return { contents, cluster: 0, area: 0, firstLeafBrush, numLeafBrushes };
}

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
