// The PVS lab's one step: from an eye in the map, which of the map's floors the renderer would
// draw, by the port's own culling (findLeafForPoint, isClusterVisible, calculateReachableAreas and
// gatherVisibleFaces from @quake2ts/engine). Pure: a map, an eye and which area portals are open
// in, each floor's fate out. The floors are the world's faces that face up (pmove's 0.7), flattened
// to a plan and kept with their height, so the lab can draw the level from above.
import {
  calculateReachableAreas,
  findLeafForPoint,
  gatherVisibleFaces,
  isClusterVisible,
} from '@quake2ts/engine';
import type { BspMap } from '@quake2ts/formats/bsp';
import type { Vec } from '../orbit';

/** A face pmove could stand on leans less than this from flat (MIN_STEP_NORMAL). */
const FLOOR_NORMAL = 0.7;
/** SURF_SKY and SURF_NODRAW: faces the renderer never draws as a floor. */
const UNDRAWN = 0x4 | 0x80;

/** One upward face of the world, flattened to the plan. */
export interface Floor {
  readonly face: number;
  /** Its corners in the plan, x and y in world units. */
  readonly points: readonly (readonly [number, number])[];
  /** Its highest corner, for drawing the upper floors over the lower. */
  readonly top: number;
  /** Its plane, to find the height under a click: z = (dist - nx x - ny y) / nz. */
  readonly plane: { readonly normal: Vec; readonly dist: number };
  /** The leaves it is listed in (a face cut by the BSP sits in several). */
  readonly leaves: readonly number[];
}

/** The world's floors, lowest first. Computed once per map. */
export function mapFloors(map: BspMap): Floor[] {
  const leavesOf = new Map<number, number[]>();
  map.leafLists.leafFaces.forEach((faces, leaf) => {
    for (const f of faces) (leavesOf.get(f) ?? leavesOf.set(f, []).get(f)!).push(leaf);
  });
  const world = map.models[0]!;
  const floors: Floor[] = [];
  for (let f = world.firstFace; f < world.firstFace + world.numFaces; f++) {
    const face = map.faces[f]!;
    if ((map.texInfo[face.texInfo]?.flags ?? 0) & UNDRAWN) continue;
    const p = map.planes[face.planeIndex]!;
    const sign = face.side ? -1 : 1;
    const normal = { x: p.normal[0] * sign, y: p.normal[1] * sign, z: p.normal[2] * sign };
    if (normal.z <= FLOOR_NORMAL) continue;
    const points: [number, number][] = [];
    let top = -Infinity;
    for (let e = 0; e < face.numEdges; e++) {
      const se = map.surfEdges[face.firstEdge + e]!;
      const v = map.vertices[se >= 0 ? map.edges[se]!.vertices[0] : map.edges[-se]!.vertices[1]]!;
      points.push([v[0], v[1]]);
      top = Math.max(top, v[2]);
    }
    floors.push({ face: f, points, top, plane: { normal, dist: p.dist * sign }, leaves: leavesOf.get(f) ?? [] });
  }
  return floors.sort((a, b) => a.top - b.top);
}

/** The height of a floor's plane under a point of the plan. */
export function floorHeight(floor: Floor, x: number, y: number): number {
  const { normal: n, dist } = floor.plane;
  return (dist - n.x * x - n.y * y) / n.z;
}

/** An area portal the map's entities name: its number and the door that opens it. */
export interface Portal {
  readonly number: number;
  /** The door's model, "*8", or null when no entity targets it. */
  readonly door: string | null;
}

/** The map's area portals, from its func_areaportal entities (qbsp writes the number as "style"). */
export function mapPortals(map: BspMap): Portal[] {
  const entities = map.entities.entities;
  return entities
    .filter((e) => e.classname === 'func_areaportal')
    .map((e) => {
      const name = e.properties.targetname;
      const door = name ? entities.find((d) => d.properties.target === name) : undefined;
      return { number: Number(e.properties.style ?? 0), door: door?.properties.model ?? null };
    })
    .filter((p) => p.number > 0);
}

/** What happens to a floor: in the eye's own cluster, drawn, culled by a closed door, or culled by the PVS. */
export type FloorFate = 'here' | 'drawn' | 'door' | 'hidden';

export interface PvsView {
  readonly eye: Vec;
  readonly leaf: number;
  /** The eye's cluster; -1 is inside a wall or outside the map, where everything is drawn. */
  readonly cluster: number;
  readonly area: number;
  readonly clusters: number;
  /** How many clusters the eye's PVS row names, its own included. */
  readonly clustersSeen: number;
  readonly worldFaces: number;
  /** World faces the renderer draws from here, before the frustum cuts more. */
  readonly facesDrawn: number;
  /** World faces in the PVS that the closed doors cut. */
  readonly facesBehindDoors: number;
  /** Areas reached from the eye's, or null when areas do not cull (no areas, or the eye is in none). */
  readonly areas: ReadonlySet<number> | null;
  readonly fate: ReadonlyMap<number, FloorFate>;
}

const PORTAL_SLOTS = 1024;
/** No frustum: every direction at once, so the plan shows the PVS and the areas alone. */
const ALL_AROUND: [] = [];

/** The view from `eye` with the given area portals open, by the port's culling. */
export function viewFrom(map: BspMap, floors: readonly Floor[], eye: Vec, open: ReadonlySet<number>): PvsView {
  const leaf = findLeafForPoint(map, eye);
  const at = leaf >= 0 ? map.leafs[leaf]! : null;
  const cluster = at?.cluster ?? -1;
  const area = at?.area ?? -1;
  const clusters = map.visibility?.numClusters ?? 0;
  let clustersSeen = 0;
  for (let c = 0; c < clusters; c++) if (isClusterVisible(map.visibility, cluster, c)) clustersSeen++;

  const portals = Array.from({ length: PORTAL_SLOTS }, (_, i) => open.has(i));
  const allOpen = new Array<boolean>(PORTAL_SLOTS).fill(true);
  const drawn = new Set(gatherVisibleFaces(map, eye, ALL_AROUND, portals).map((f) => f.faceIndex));
  const inPvs = new Set(gatherVisibleFaces(map, eye, ALL_AROUND, allOpen).map((f) => f.faceIndex));
  const areas = area >= 0 && map.areas.length > 0 ? calculateReachableAreas(map, area, portals) : null;

  const fate = new Map<number, FloorFate>();
  for (const floor of floors) {
    if (cluster >= 0 && floor.leaves.some((l) => map.leafs[l]!.cluster === cluster)) fate.set(floor.face, 'here');
    else if (drawn.has(floor.face)) fate.set(floor.face, 'drawn');
    else if (inPvs.has(floor.face)) fate.set(floor.face, 'door');
    else fate.set(floor.face, 'hidden');
  }
  const world = map.models[0]!;
  return {
    eye,
    leaf,
    cluster,
    area,
    clusters,
    clustersSeen,
    worldFaces: world.numFaces,
    facesDrawn: countWorld(drawn, world.firstFace, world.numFaces),
    facesBehindDoors: countWorld(inPvs, world.firstFace, world.numFaces) - countWorld(drawn, world.firstFace, world.numFaces),
    areas,
    fate,
  };
}

function countWorld(faces: ReadonlySet<number>, first: number, count: number): number {
  let n = 0;
  for (const f of faces) if (f >= first && f < first + count) n++;
  return n;
}
