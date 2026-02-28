import { describe, it, expect } from 'vitest';
import { generatePortals, Portal } from '../../../src/compiler/portals.js';
import { TreeElement, TreeNode, TreeLeaf } from '../../../src/compiler/tree.js';
import { CompilePlane } from '../../../src/types/compile.js';
import { createEmptyBounds3, CONTENTS_SOLID } from '@quake2ts/shared';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { buildTree, isLeaf } from '../../../src/compiler/tree.js';
import { processCsg, calculateBounds } from '../../../src/compiler/csg.js';
import { box } from '../../../src/builder/primitives.js';
import { generateBrushWindings } from '../../../src/compiler/brushProcessing.js';
import type { BrushDef } from '../../../src/builder/types.js';
import type { CompileBrush, CompileSide, MapBrush } from '../../../src/types/compile.js';

export function createCompileBrush(def: BrushDef, planeSet: PlaneSet, contents: number = 1): CompileBrush {
  const windings = generateBrushWindings(def);
  const sides: CompileSide[] = [];

  def.sides.forEach((s, i) => {
    const planeNum = planeSet.findOrAdd(s.plane.normal, s.plane.dist);
    sides.push({
      planeNum,
      texInfo: 0,
      winding: windings.get(i),
      visible: true,
      tested: false,
      bevel: false
    });
  });

  const bounds = calculateBounds(sides);

  const mapBrush: MapBrush = {
    entityNum: 0,
    brushNum: 0,
    sides,
    bounds,
    contents
  };

  return {
    original: mapBrush,
    sides,
    bounds,
    next: null
  };
}

describe('Portals', () => {
  it('generates real portals for a simple room using full CSG and Tree building', () => {
    const planeSet = new PlaneSet();

    // Create a hallway composed of brushes. We need two adjacent brushes.
    // But brushes define solid space. The space *between* solid brushes is empty space.
    // In Quake 2, the bounding box of all brushes defines the world.
    // Let's create two solid blocks that form a split, but leave a gap.
    // Wait, the standard BSP buildTree splits space until it is convex,
    // and space NOT occupied by brushes is empty (CONTENTS_NONE).

    // Block 1: solid wall on -X
    const b1 = createCompileBrush(box({ origin: {x:-100,y:0,z:0}, size: {x: 100, y: 100, z: 100} }), planeSet, CONTENTS_SOLID);
    // Block 2: solid wall on +X
    const b2 = createCompileBrush(box({ origin: {x:100,y:0,z:0}, size: {x: 100, y: 100, z: 100} }), planeSet, CONTENTS_SOLID);

    const brushes = processCsg([b1, b2], planeSet);
    const root = buildTree(brushes, planeSet, new Set());

    const planes = planeSet.getPlanes();

    // In a map like this, the bounds span from -150 to +150 on X, and -50 to 50 on Y/Z.
    // The space between the blocks (-50 to 50 on X) should be an empty leaf,
    // bounded by solid leaves.
    // Since we just have 2 separated solid blocks, the BSP will split them, creating
    // solid and empty leaves.

    const portals = generatePortals(root, planes, {x: -200, y: -200, z: -200}, {x: 200, y: 200, z: 200});

    // Ensure portals are generated
    expect(portals.length).toBeGreaterThan(0);

    // Check if any portal correctly links to a leaf node and populates its portals array
    let leafWithPortals = false;

    function walk(node: TreeElement) {
        if (isLeaf(node)) {
            if (node.portals && node.portals.length > 0) {
                leafWithPortals = true;
            }
        } else {
            walk(node.children[0]);
            walk(node.children[1]);
        }
    }

    walk(root);

    expect(leafWithPortals).toBe(true);
  });

  it('generatePortals creates portals bounding the map and separating nodes', () => {
    // Create a mock tree with a single root node splitting two leaves
    const planes: CompilePlane[] = [
      { normal: { x: 1, y: 0, z: 0 }, dist: 0, type: 0 } // split on YZ plane
    ];

    const leafFront: TreeLeaf = {
      contents: 1,
      brushes: [],
      bounds: { mins: { x: 0, y: -100, z: -100 }, maxs: { x: 100, y: 100, z: 100 } }
    };

    const leafBack: TreeLeaf = {
      contents: 1,
      brushes: [],
      bounds: { mins: { x: -100, y: -100, z: -100 }, maxs: { x: 0, y: 100, z: 100 } }
    };

    const rootNode: TreeNode = {
      planeNum: 0,
      children: [leafFront, leafBack],
      bounds: { mins: { x: -100, y: -100, z: -100 }, maxs: { x: 100, y: 100, z: 100 } }
    };

    leafFront.parent = rootNode;
    leafBack.parent = rootNode;

    const portals = generatePortals(rootNode, planes, rootNode.bounds.mins, rootNode.bounds.maxs);

    // 6 outer bounding portals + 1 inner splitting portal
    expect(portals.length).toBe(7);

    // Find the inner portal (planeNum 0)
    const innerPortal = portals.find(p => p.planeNum === 0);
    expect(innerPortal).toBeDefined();

    // Check nodes for the inner portal
    expect(innerPortal?.nodes[0]).toBe(leafFront);
    expect(innerPortal?.nodes[1]).toBe(leafBack);

    // The inner portal should have a winding
    expect(innerPortal?.winding).toBeDefined();
    expect(innerPortal?.winding.numPoints).toBeGreaterThanOrEqual(3);
  });
});
