import { Vec3, PmoveTraceResult, CollisionModel, buildCollisionModel, CollisionLumpData, traceBox, pointContents as sharedPointContents } from '@quake2ts/shared';
import { BspMap } from './assets/bsp.js';

let collisionModel: CollisionModel | null = null;

export function loadCollisionModel(bspMap: BspMap) {
    const lumpData: CollisionLumpData = {
        planes: bspMap.planes.map((plane) => ({
            normal: { x: plane.normal[0], y: plane.normal[1], z: plane.normal[2] },
            dist: plane.dist,
            type: plane.type,
        })),
        nodes: bspMap.nodes.map((node) => ({
            planenum: node.planeIndex,
            children: [node.children[0], node.children[1]],
        })),
        leaves: bspMap.leafs.map((leaf) => ({
            contents: leaf.contents,
            cluster: leaf.cluster,
            area: leaf.area,
            firstLeafBrush: leaf.firstLeafBrush,
            numLeafBrushes: leaf.numLeafBrushes,
        })),
        brushes: bspMap.brushes.map((brush) => ({
            firstSide: brush.firstSide,
            numSides: brush.numSides,
            contents: brush.contents,
        })),
        brushSides: bspMap.brushSides.map((side) => ({
            planenum: side.planeIndex,
            surfaceFlags: side.texInfo,
        })),
        leafBrushes: Array.from(bspMap.leafLists.leafBrushes.flat()),
        bmodels: bspMap.models.map((model) => ({
            mins: { x: model.mins[0], y: model.mins[1], z: model.mins[2] },
            maxs: { x: model.maxs[0], y: model.maxs[1], z: model.maxs[2] },
            origin: { x: model.origin[0], y: model.origin[1], z: model.origin[2] },
            headnode: model.headNode,
        })),
    };
    collisionModel = buildCollisionModel(lumpData);
}

export const trace = (start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3): PmoveTraceResult => {
    if (!collisionModel) {
        return {
            fraction: 1,
            endpos: end,
            startsolid: false,
            allsolid: false,
        };
    }

    return traceBox({
        model: collisionModel,
        start,
        end,
        mins,
        maxs,
    });
};

export const pointContents = (point: Vec3): number => {
    if (!collisionModel) {
        return 0;
    }

    return sharedPointContents(point, collisionModel);
};
