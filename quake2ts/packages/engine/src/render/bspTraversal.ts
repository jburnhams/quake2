import { type Vec3 } from '@quake2ts/shared';
import type {
  BspLeaf,
  BspMap,
  BspNode,
  BspPlane,
  BspVisibility,
} from '../assets/bsp.js';
import { boxIntersectsFrustum, type FrustumPlane } from './culling.js';

export interface VisibleFace {
  readonly faceIndex: number;
  readonly leafIndex: number;
  readonly sortKey: number;
}

function childIsLeaf(index: number): boolean {
  return index < 0;
}

function childLeafIndex(index: number): number {
  return -index - 1;
}

function distanceToPlane(plane: BspPlane, point: Vec3): number {
  return plane.normal[0] * point.x + plane.normal[1] * point.y + plane.normal[2] * point.z - plane.dist;
}

function isClusterVisible(visibility: BspVisibility | undefined, fromCluster: number, testCluster: number): boolean {
  if (!visibility) {
    return true;
  }
  if (fromCluster < 0 || testCluster < 0) {
    return true;
  }
  const rowBytes = Math.ceil(visibility.numClusters / 8);
  const row = visibility.clusters[fromCluster].pvs;
  const byteIndex = Math.floor(testCluster / 8);
  const bit = 1 << (testCluster % 8);
  if (byteIndex < 0 || byteIndex >= rowBytes) {
    return false;
  }
  return (row[byteIndex] & bit) !== 0;
}

function leafIntersectsFrustum(leaf: BspLeaf, planes: readonly FrustumPlane[]): boolean {
  const mins = { x: leaf.mins[0], y: leaf.mins[1], z: leaf.mins[2] };
  const maxs = { x: leaf.maxs[0], y: leaf.maxs[1], z: leaf.maxs[2] };
  return boxIntersectsFrustum(mins, maxs, planes);
}

export function findLeafForPoint(map: BspMap, point: Vec3): number {
  let nodeIndex = 0;
  while (nodeIndex >= 0) {
    const node: BspNode = map.nodes[nodeIndex];
    const plane = map.planes[node.planeIndex];
    const dist = distanceToPlane(plane, point);
    const side = dist >= 0 ? 0 : 1;
    const child = node.children[side];
    if (childIsLeaf(child)) {
      return childLeafIndex(child);
    }
    nodeIndex = child;
  }
  return -1;
}

function collectFacesFromLeaf(map: BspMap, leafIndex: number): number[] {
  const leaf = map.leafs[leafIndex];
  const faces: number[] = [];
  for (let i = 0; i < leaf.numLeafFaces; i += 1) {
    faces.push(map.leafLists.leafFaces[leafIndex][i]);
  }
  return faces;
}

function traverse(
  map: BspMap,
  nodeIndex: number,
  camera: Vec3,
  frustum: readonly FrustumPlane[],
  viewCluster: number,
  visibleFaces: VisibleFace[],
  visitedFaces: Set<number>
): void {
  if (childIsLeaf(nodeIndex)) {
    const leafIndex = childLeafIndex(nodeIndex);
    const leaf = map.leafs[leafIndex];
    if (!isClusterVisible(map.visibility, viewCluster, leaf.cluster)) {
      return;
    }
    if (!leafIntersectsFrustum(leaf, frustum)) {
      return;
    }
    const center = {
      x: (leaf.mins[0] + leaf.maxs[0]) * 0.5,
      y: (leaf.mins[1] + leaf.maxs[1]) * 0.5,
      z: (leaf.mins[2] + leaf.maxs[2]) * 0.5,
    };
    const dx = center.x - camera.x;
    const dy = center.y - camera.y;
    const dz = center.z - camera.z;
    const leafSortKey = -(dx * dx + dy * dy + dz * dz);
    for (const faceIndex of collectFacesFromLeaf(map, leafIndex)) {
      if (visitedFaces.has(faceIndex)) {
        continue;
      }
      visitedFaces.add(faceIndex);
      visibleFaces.push({ faceIndex, leafIndex, sortKey: leafSortKey });
    }
    return;
  }

  const node = map.nodes[nodeIndex];
  const plane = map.planes[node.planeIndex];
  const dist = distanceToPlane(plane, camera);
  const nearChild = dist >= 0 ? node.children[0] : node.children[1];
  const farChild = dist >= 0 ? node.children[1] : node.children[0];

  if (boxIntersectsFrustum(
    { x: node.mins[0], y: node.mins[1], z: node.mins[2] },
    { x: node.maxs[0], y: node.maxs[1], z: node.maxs[2] },
    frustum,
  )) {
    traverse(map, nearChild, camera, frustum, viewCluster, visibleFaces, visitedFaces);
    traverse(map, farChild, camera, frustum, viewCluster, visibleFaces, visitedFaces);
  }
}

export function gatherVisibleFaces(
  map: BspMap,
  cameraPosition: Vec3,
  frustum: readonly FrustumPlane[],
): VisibleFace[] {
  const viewLeaf = findLeafForPoint(map, cameraPosition);
  const viewCluster = viewLeaf >= 0 ? map.leafs[viewLeaf].cluster : -1;
  const visibleFaces: VisibleFace[] = [];
  const visitedFaces = new Set<number>();
  traverse(map, 0, cameraPosition, frustum, viewCluster, visibleFaces, visitedFaces);
  return visibleFaces;
}
