import type { BspMap, BspLeaf, Vec3 } from '../assets/bsp.js';

export function findLeafForPoint(map: BspMap, point: Vec3): BspLeaf | undefined {
    let nodeIndex = 0; // Head node (usually 0)

    // Traverse the BSP tree until we hit a leaf
    // Leaf indices are negative: -(leafIndex + 1)

    // The BspMap interface exposes nodes and leafs.
    // BspNode children are indices. If > 0 it's a node, if < 0 it's a leaf.
    // Actually, checking BspLoader implementation:
    // const children: [number, number] = [view.getInt32(base + 4, true), view.getInt32(base + 8, true)];
    // These are signed ints.

    // Standard BSP traversal:
    while (nodeIndex >= 0) {
        // Safe check for valid node index
        if (nodeIndex >= map.nodes.length) return undefined;

        const node = map.nodes[nodeIndex];
        const plane = map.planes[node.planeIndex];

        // Dot product to determine side
        const dist =
            plane.normal[0] * point[0] +
            plane.normal[1] * point[1] +
            plane.normal[2] * point[2] -
            plane.dist;

        if (dist >= 0) {
            nodeIndex = node.children[0];
        } else {
            nodeIndex = node.children[1];
        }
    }

    const leafIndex = -(nodeIndex + 1);
    if (leafIndex >= 0 && leafIndex < map.leafs.length) {
        return map.leafs[leafIndex];
    }
    return undefined;
}

export function estimateRoomSize(map: BspMap, point: Vec3): number {
    const leaf = findLeafForPoint(map, point);
    if (!leaf) return 0;

    // Quick estimation based on leaf bounds
    // This is a very rough approximation.
    // A better approach would be to traverse adjacent leaves through portals,
    // but without portal info readily exposed and linked in a way that's easy to traverse here,
    // we might just stick to the leaf size or a trace-based approach.

    // Since we have collision geometry, a trace-based approach is more robust for "apparent" size.
    // We can cast rays in 6 directions (up, down, left, right, forward, back) and calculate volume.

    // However, we don't have easy access to collision tracing here (it's in Shared or Game).
    // The BspMap in Engine has `pickEntity` but not `trace`.
    // Wait, BspMap has `nodes`, `planes`, `brushes`. We can implement a simplified ray-brush intersection or ray-world intersection.
    // Or we can just use the leaf bounds as a heuristic.

    // Leaf bounds might be small if the room is split into many leaves.
    // But room detection usually requires `floodFill` across PVS or portals.

    // Let's implement a simplified raycaster using `map.nodes` for world geometry.
    // We can reuse the logic from `findLeafForPoint` but for ray traversal?
    // Actually, `parseBsp` exposes `pickEntity` but not `traceWorld`.

    // Let's look at `packages/shared/src/bsp/collision.ts`.
    // It seems collision logic is in Shared.
    // But we are in Engine.

    // If this is for Audio Reverb, we probably want a loose heuristic.
    // Let's try to compute the volume of the leaf cluster.
    // `leaf.cluster` identifies the visibility cluster.
    // We can iterate over all leaves, check if they belong to the same cluster, and sum their volumes.
    // This assumes a room corresponds roughly to a cluster (or set of visible clusters).

    if (leaf.cluster === -1) {
        // Outside or special area
        return 0;
    }

    let totalVolume = 0;
    // Iterate all leaves
    for (const otherLeaf of map.leafs) {
        if (otherLeaf.cluster === leaf.cluster) {
             const dx = otherLeaf.maxs[0] - otherLeaf.mins[0];
             const dy = otherLeaf.maxs[1] - otherLeaf.mins[1];
             const dz = otherLeaf.maxs[2] - otherLeaf.mins[2];
             totalVolume += dx * dy * dz;
        }
    }

    return totalVolume;
}

export function getReverbPresetForVolume(volume: number): string {
    // Volume is in cubic units (Quake units).
    // 1 Quake unit ~ 1 inch? Or 1 unit?
    // Player height is 56ish.
    // Small room: 256x256x128 = ~8M units?

    // Let's define some thresholds
    // Very Small: < 2000^3 ?? No.
    // 128*128*128 = 2,097,152

    if (volume < 1000000) return 'small'; // Closet / hallway
    if (volume < 10000000) return 'medium'; // Standard room
    if (volume < 50000000) return 'large'; // Large hall
    return 'huge'; // Outdoor / cavern
}
