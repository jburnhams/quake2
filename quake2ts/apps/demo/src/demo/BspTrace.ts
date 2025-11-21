import { BspMap } from '@quake2ts/engine';
import { PmoveTraceFn, PmoveTraceResult, Vec3 } from '@quake2ts/shared';
import { buildCollisionModel, traceBox, CollisionLumpData } from '@quake2ts/shared/dist/bsp/collision.js';

function bspMapToCollisionLumpData(map: BspMap): CollisionLumpData {
    return {
        planes: map.planes.map(p => ({ normal: { x: p.normal[0], y: p.normal[1], z: p.normal[2] }, dist: p.dist, type: p.type })),
        nodes: map.nodes.map(n => ({ planenum: n.planeIndex, children: [n.children[0], n.children[1]] })),
        leaves: map.leafs.map(l => ({ contents: l.contents, cluster: l.cluster, area: l.area, firstLeafBrush: l.firstLeafBrush, numLeafBrushes: l.numLeafBrushes })),
        brushes: map.brushes.map(b => ({ firstSide: b.firstSide, numSides: b.numSides, contents: b.contents })),
        brushSides: map.brushSides.map(bs => ({ planenum: bs.planeIndex, surfaceFlags: bs.texInfo })), // TODO: texInfo is not the correct source for surfaceFlags
        leafBrushes: map.leafLists.leafBrushes.flat(),
        bmodels: map.models.map(m => ({
            mins: { x: m.mins[0], y: m.mins[1], z: m.mins[2] },
            maxs: { x: m.maxs[0], y: m.maxs[1], z: m.maxs[2] },
            origin: { x: m.origin[0], y: m.origin[1], z: m.origin[2] },
            headnode: m.headNode
        })),
        visibility: map.visibility ? {
            numClusters: map.visibility.numClusters,
            clusters: map.visibility.clusters.map(c => ({ pvs: c.pvs, phs: c.phs })),
        } : undefined,
    };
}

export function createBspTrace(map: BspMap): PmoveTraceFn {
    const lumpData = bspMapToCollisionLumpData(map);
    const model = buildCollisionModel(lumpData);

    return (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3): PmoveTraceResult => {
        const result = traceBox({
            model,
            start,
            end,
            mins,
            maxs,
            headnode: 0,
        });

        return {
            fraction: result.fraction,
            endpos: result.endpos,
            planeNormal: result.planeNormal,
            allsolid: result.allsolid,
            startsolid: result.startsolid,
            contents: result.contents,
            surfaceFlags: result.surfaceFlags,
        };
    };
}
