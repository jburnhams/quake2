import type { Vec3 } from '../math/vec3.js';

export const AREA_DEPTH = 4;
export const WORLD_SIZE = 8192; // Standard Q2 world extent

export interface SpatialNode {
  axis: number; // 0=X, 1=Y, -1=Leaf
  dist: number;
  children: [SpatialNode, SpatialNode] | null;
  items: Set<number>;
}

export function createSpatialTree(
  depth = 0,
  mins: Vec3 = { x: -WORLD_SIZE, y: -WORLD_SIZE, z: -WORLD_SIZE },
  maxs: Vec3 = { x: WORLD_SIZE, y: WORLD_SIZE, z: WORLD_SIZE }
): SpatialNode {
  if (depth >= AREA_DEPTH) {
    return {
      axis: -1,
      dist: 0,
      children: null,
      items: new Set(),
    };
  }

  const axis = depth % 2; // Alternates X (0) and Y (1)
  const dist = 0.5 * (axis === 0 ? mins.x + maxs.x : mins.y + maxs.y);

  const mins1 = { ...mins };
  const maxs1 = { ...maxs };
  const mins2 = { ...mins };
  const maxs2 = { ...maxs };

  if (axis === 0) {
    maxs1.x = dist;
    mins2.x = dist;
  } else {
    maxs1.y = dist;
    mins2.y = dist;
  }

  const child1 = createSpatialTree(depth + 1, mins1, maxs1);
  const child2 = createSpatialTree(depth + 1, mins2, maxs2);

  return {
    axis,
    dist,
    children: [child1, child2],
    items: new Set(),
  };
}

export function linkEntityToSpatialTree(
  node: SpatialNode,
  id: number,
  absmin: Vec3,
  absmax: Vec3
): SpatialNode {
  let current = node;

  while (current.axis !== -1 && current.children) {
    const axis = current.axis;
    const dist = current.dist;

    const min = axis === 0 ? absmin.x : absmin.y;
    const max = axis === 0 ? absmax.x : absmax.y;

    if (min > dist) {
      current = current.children[1];
    } else if (max < dist) {
      current = current.children[0];
    } else {
      break; // Straddles the plane, resides in this node
    }
  }

  current.items.add(id);
  return current;
}

export function querySpatialTree(
  node: SpatialNode,
  absmin: Vec3,
  absmax: Vec3,
  results: Set<number>
): void {
  // Add all items in the current node (because if we are here, we overlap this node's space
  // and straddling items definitely overlap us or are at least in the parent region)
  // Actually, strictly speaking, items in this node straddle the split plane.
  // Since we are traversing down, we are within the node's volume.
  // The items in this node are those that couldn't be pushed further down.
  // So we must check them.

  // NOTE: This collects candidates. Precise collision check still needed.
  for (const id of node.items) {
    results.add(id);
  }

  if (node.axis === -1 || !node.children) {
    return;
  }

  const axis = node.axis;
  const dist = node.dist;

  const min = axis === 0 ? absmin.x : absmin.y;
  const max = axis === 0 ? absmax.x : absmax.y;

  if (max > dist) {
    querySpatialTree(node.children[1], absmin, absmax, results);
  }
  if (min < dist) {
    querySpatialTree(node.children[0], absmin, absmax, results);
  }
}
