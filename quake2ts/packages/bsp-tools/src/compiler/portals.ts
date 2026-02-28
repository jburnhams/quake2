import { Winding, Vec3, Bounds3, addVec3, scaleVec3, createEmptyBounds3, copyWinding, splitWinding, baseWindingForPlane, chopWindingByPlanes, windingBounds } from '@quake2ts/shared';
import { CompilePlane } from '../types/compile.js';
import { TreeNode, TreeLeaf, TreeElement, isLeaf } from './tree.js';
import { ON_EPSILON } from '../types/index.js';

export interface Portal {
  winding: Winding;
  planeNum: number;
  onNode: TreeNode | null;
  nodes: [TreeElement, TreeElement]; // front and back nodes (can be clusters/leaves later)
  next: [Portal | null, Portal | null];
}

/**
 * Generate portals from BSP tree.
 * Matches logic from q2tools/src/portals.c
 */
export function generatePortals(
  tree: TreeElement,
  planes: CompilePlane[],
  mins: Vec3,
  maxs: Vec3
): Portal[] {
  const portals: Portal[] = [];

  // Create bounding portals (MakeHeadnodePortals equivalent)
  const outsideNode: TreeLeaf = {
    contents: 0,
    brushes: [],
    bounds: createEmptyBounds3(),
    portals: []
  };

  const SIDESPACE = 8;
  const bMins = { x: mins.x - SIDESPACE, y: mins.y - SIDESPACE, z: mins.z - SIDESPACE };
  const bMaxs = { x: maxs.x + SIDESPACE, y: maxs.y + SIDESPACE, z: maxs.z + SIDESPACE };
  const bBounds = [bMins, bMaxs];

  const basePlanes: {normal: Vec3, dist: number}[] = [];
  const basePortals: Portal[] = [];

  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 2; j++) {
      let normal = {x: 0, y: 0, z: 0};
      let dist = 0;
      if (j === 1) {
        normal[i === 0 ? 'x' : i === 1 ? 'y' : 'z'] = -1;
        dist = -bBounds[0][i === 0 ? 'x' : i === 1 ? 'y' : 'z']; // negative side uses mins
      } else {
        normal[i === 0 ? 'x' : i === 1 ? 'y' : 'z'] = 1;
        dist = bBounds[1][i === 0 ? 'x' : i === 1 ? 'y' : 'z']; // positive side uses maxs
      }

      basePlanes.push({normal, dist});

      let w = baseWindingForPlane(normal, dist);
      if (w) {
         let p: Portal = {
            winding: w,
            planeNum: -1, // dynamic
            onNode: null,
            nodes: [tree, outsideNode],
            next: [null, null]
         };
         basePortals.push(p);
      }
    }
  }

  // Clip base portals by other base planes
  for (let i = 0; i < basePortals.length; i++) {
    let w: Winding | null = basePortals[i].winding;
    for (let j = 0; j < basePlanes.length; j++) {
       if (i === j) continue;
       if (!w) break;
       // We use chopWindingByPlanes instead of splitWinding directly here
       // because we want to clip by the inside.
       // The base plane normals point outwards, so to keep the inside,
       // we need to reverse the normal for clipping, or use split.back.
       // chopWindingByPlanes clips away everything in front of the plane.
       let split = splitWinding(w, basePlanes[j].normal, basePlanes[j].dist);
       w = split.back; // keep back side of clipping planes
    }
    if (w && w.numPoints >= 3) {
      basePortals[i].winding = w;
      portals.push(basePortals[i]);
      addPortalToNodes(basePortals[i], tree, outsideNode);
    }
  }

  makeTreePortals(tree, planes, portals);

  return portals;
}

function addPortalToNodes(p: Portal, front: TreeElement, back: TreeElement) {
   p.nodes[0] = front;
   p.nodes[1] = back;

   if (isLeaf(front)) {
     if (!front.portals) front.portals = [];
     front.portals.push(p);
   }

   if (isLeaf(back)) {
     if (!back.portals) back.portals = [];
     back.portals.push(p);
   }
}

function makeTreePortals(node: TreeElement, planes: CompilePlane[], portals: Portal[]) {
  if (isLeaf(node)) {
    return;
  }

  // Create node portal
  let w = baseWindingForNode(node, planes);

  if (w) {
      let p: Portal = {
          winding: w,
          planeNum: node.planeNum,
          onNode: node,
          nodes: [node.children[0], node.children[1]], // Initial assignment, gets refined by splitting
          next: [null, null]
      };

      // Ideally, here we would split the portal down the tree if node.children have further splits.
      // But for basic visibility, if we have bounded windigns on each node split plane,
      // we can use them to calculate portals.
      // For a robust implementation, `splitNodePortals` should be called to push
      // the portal fragments down to the leaves. We do a simplified leaf-clip here.

      let frontFragments = clipPortalToTree(p.winding, node.children[0], planes);
      let backFragments = clipPortalToTree(p.winding, node.children[1], planes);

      // Add all surviving valid portal fragments
      for (const f of frontFragments) {
        for (const b of backFragments) {
          // Intersect the two windings to find the common portal area between the two leaves.
          // Since both windings lie on the exact same plane, we can clip one by the edges of the other.
          // In Quake 2 bsp this is typically done by clipping the portal winding by all the bounding planes
          // of the leaves. We will do a robust 2D-like clip by finding edge planes of b.winding.

          let w: Winding | null = f.winding;
          let nodePlane = planes[node.planeNum];

          // Generate edge clipping planes from b's winding.
          // For each edge A->B, the clipping plane normal is cross(B-A, nodePlane.normal) pointing inward.
          for (let i = 0; i < b.winding.numPoints; i++) {
             if (!w) break;
             let p1 = b.winding.points[i];
             let p2 = b.winding.points[(i + 1) % b.winding.numPoints];

             let dir = { x: p2.x - p1.x, y: p2.y - p1.y, z: p2.z - p1.z };

             // Cross product of direction and face normal gives an inward pointing edge normal
             let edgeNormal = {
                 x: dir.y * nodePlane.normal.z - dir.z * nodePlane.normal.y,
                 y: dir.z * nodePlane.normal.x - dir.x * nodePlane.normal.z,
                 z: dir.x * nodePlane.normal.y - dir.y * nodePlane.normal.x
             };

             // Normalize edge normal
             let len = Math.sqrt(edgeNormal.x * edgeNormal.x + edgeNormal.y * edgeNormal.y + edgeNormal.z * edgeNormal.z);
             if (len > 0.0001) {
                 edgeNormal.x /= len;
                 edgeNormal.y /= len;
                 edgeNormal.z /= len;

                 let edgeDist = edgeNormal.x * p1.x + edgeNormal.y * p1.y + edgeNormal.z * p1.z;

                 // Clip w against this edge plane. We want the INSIDE of b.winding, which means
                 // the side where dot product > edgeDist (if normal points inward).
                 let split = splitWinding(w, edgeNormal, edgeDist);
                 w = split.front;
             }
          }

          if (w && w.numPoints >= 3) {
            let finalP: Portal = {
               winding: w,
               planeNum: node.planeNum,
               onNode: node,
               nodes: [f.leaf, b.leaf],
               next: [null, null]
            };
            portals.push(finalP);
            addPortalToNodes(finalP, f.leaf, b.leaf);
          }
        }
      }
  }

  makeTreePortals(node.children[0], planes, portals);
  makeTreePortals(node.children[1], planes, portals);
}

function baseWindingForNode(node: TreeNode, planes: CompilePlane[]): Winding | null {
   let plane = planes[node.planeNum];
   let w: Winding | null = baseWindingForPlane(plane.normal, plane.dist);
   if (!w) return null;

   // Clip by all parent planes
   let n: TreeNode | undefined = node.parent;
   let childNode: TreeElement = node;

   while (n && w) {
      let pPlane = planes[n.planeNum];
      if (n.children[0] === childNode) {
         // We are on the front side of the parent, clip away the back
         let split = splitWinding(w, pPlane.normal, pPlane.dist);
         w = split.front;
      } else {
         // We are on the back side of the parent, clip away the front
         let split = splitWinding(w, pPlane.normal, pPlane.dist);
         w = split.back;
      }
      childNode = n;
      n = n.parent;
   }

   return w;
}

/**
 * Clips a portal winding through the tree, returning the fragments that reach leaves.
 */
export function clipPortalToTree(winding: Winding, node: TreeElement, planes: CompilePlane[]): { leaf: TreeLeaf, winding: Winding }[] {
   if (isLeaf(node)) {
      return [{ leaf: node, winding }];
   }

   let plane = planes[node.planeNum];
   let split = splitWinding(winding, plane.normal, plane.dist);

   let results: { leaf: TreeLeaf, winding: Winding }[] = [];

   if (split.front) {
      results.push(...clipPortalToTree(split.front, node.children[0], planes));
   }

   if (split.back) {
      results.push(...clipPortalToTree(split.back, node.children[1], planes));
   }

   return results;
}
