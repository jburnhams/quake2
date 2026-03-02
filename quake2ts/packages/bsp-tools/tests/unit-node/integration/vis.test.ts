import { describe, it, expect } from 'vitest';
import { generatePortals } from '../../../src/compiler/portals.js';
import { PlaneSet } from '../../../src/compiler/planes.js';
import { buildTree, flattenTree } from '../../../src/compiler/tree.js';
import { processCsg } from '../../../src/compiler/csg.js';
import { box } from '../../../src/builder/primitives.js';
import { CONTENTS_SOLID } from '@quake2ts/shared';
import { createCompileBrush } from '../compiler/helpers.js';
import { initializePortalFlow, floodFillVisibility } from '../../../src/compiler/vis.js';

describe('Visibility Integration Flow', () => {
  it('correctly processes end-to-end portal connectivity with map brushes', () => {
    const planeSet = new PlaneSet();

    // Create a hallway composed of brushes:
    // Block 1: solid wall on -X
    // Block 2: solid wall on +X
    // Block 3: solid wall on +Y
    // Space remaining: Central L-shaped hallway or room between brushes
    const b1 = createCompileBrush(box({ origin: { x: -100, y: 0, z: 0 }, size: { x: 100, y: 100, z: 100 } }), planeSet, CONTENTS_SOLID);
    const b2 = createCompileBrush(box({ origin: { x: 100, y: 0, z: 0 }, size: { x: 100, y: 100, z: 100 } }), planeSet, CONTENTS_SOLID);
    const b3 = createCompileBrush(box({ origin: { x: 0, y: 100, z: 0 }, size: { x: 100, y: 100, z: 100 } }), planeSet, CONTENTS_SOLID);

    const brushes = processCsg([b1, b2, b3], planeSet);
    const root = buildTree(brushes, planeSet, new Set());

    const planes = planeSet.getPlanes();
    const portals = generatePortals(root, planes, { x: -200, y: -200, z: -200 }, { x: 200, y: 200, z: 200 });

    // Flatten tree to assign structural IDs and clusters to non-solid leaves
    // Note: flattenTree expects a Map of faces, we can pass an empty map since we aren't doing face extraction here
    const { leafs, nodes } = flattenTree(root, new Map());
    const solidLeaves = leafs.filter(l => l.contents === CONTENTS_SOLID);
    const nonSolidLeaves = leafs.filter(l => l.contents !== CONTENTS_SOLID);

    expect(portals.length).toBeGreaterThan(0);
    expect(nonSolidLeaves.length).toBeGreaterThan(0);

    const numClusters = nonSolidLeaves.length; // From flattenTree logic

    // Check that we initialized cluster correctly and validly
    for (let i = 0; i < numClusters; i++) {
        expect(nonSolidLeaves[i].cluster).toBe(i);
    }

    // Pass portals into VIS flow
    const state = initializePortalFlow(portals, numClusters);

    expect(state.numClusters).toBe(numClusters);

    // Test flood-fill visibility: check if clusters see each other via portals
    // Since it's an open block, they likely form one interconnected space.
    if (numClusters > 1) {
        // Just take the first valid cluster
        const startCluster = nonSolidLeaves[0].cluster!;
        const reachable = floodFillVisibility(state, startCluster);

        // Every reachable empty leaf from start should be marked
        expect(reachable.get(startCluster)).toBe(true);

        // Not every cluster has to be reachable depending on bounds padding
        // but it should return a valid bitset.
        let hasConnections = false;
        for (let i = 0; i < numClusters; i++) {
           if (i !== startCluster && reachable.get(i)) {
               hasConnections = true;
           }
        }
        // Since portals link all adjacent exterior space bounding boxes,
        // there should be at least one topological connection.
        expect(hasConnections).toBe(true);
    }
  });
});
