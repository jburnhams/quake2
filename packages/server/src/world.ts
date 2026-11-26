/**
 * The server's view of where entities are: a port of id Software's sv_world.c.
 *
 * Entities are linked into a small fixed tree of area nodes (depth 4 over the world's
 * bounds, split on x or y). Traces and point-contents first hit the world BSP, then
 * every solid entity whose box overlaps the move: brush entities (doors, plats) through
 * their own submodel moved to their origin and angles, everything else through a box
 * hull. Triggers are kept in a separate list and never block movement.
 *
 * This replaces the old shortcuts where every entity collided as an axis-aligned box
 * with contents 1, point contents always returned 0, and freed entities stayed linked.
 */
import {
  CONTENTS_DEADMONSTER,
  boxLeafnums,
  headnodeForBox,
  pointContents,
  transformedBoxTrace,
  transformedPointContents,
  traceBox,
  type CollisionModel,
  type CollisionTraceResult,
  type Vec3,
} from '@quake2ts/shared';
import { ServerFlags, Solid } from '@quake2ts/game';

/** The fields sv_world.c reads and writes on an edict. Game entities satisfy it. */
export interface WorldEntity {
  readonly index: number;
  inUse: boolean;
  solid: Solid;
  svflags: number;
  origin: Vec3;
  angles: Vec3;
  mins: Vec3;
  maxs: Vec3;
  absmin: Vec3;
  absmax: Vec3;
  size: Vec3;
  modelindex: number;
  linkcount: number;
  owner: WorldEntity | null;
}

export interface WorldTraceResult<E extends WorldEntity> extends CollisionTraceResult {
  /** The world entity for a hit on map geometry or no hit at all, as in the original. */
  ent: E;
}

/** Where a linked entity is, for PVS culling when frames are built. */
export interface LinkInfo {
  readonly clusters: readonly number[];
  /** More clusters than the original's MAX_ENT_CLUSTERS (16): treat as visible from anywhere it could be. */
  readonly clustersOverflow: boolean;
  readonly areanum: number;
  readonly areanum2: number;
}

export const enum AreaType {
  Solid = 1,
  Triggers = 2,
}

const AREA_DEPTH = 4;
const MAX_TOTAL_ENT_LEAFS = 128;
const MAX_ENT_CLUSTERS = 16;

interface AreaNode<E> {
  axis: -1 | 0 | 1;
  dist: number;
  children: [AreaNode<E> | null, AreaNode<E> | null];
  readonly solids: Set<E>;
  readonly triggers: Set<E>;
}

interface Link<E> {
  node: AreaNode<E>;
  list: Set<E>;
  info: LinkInfo;
}

export interface WorldOptions {
  readonly model: CollisionModel;
  /** Headnode of the submodel an entity's modelindex names ("*3" → submodel 3), or undefined if it is not one. */
  readonly submodelHeadnode: (modelindex: number) => number | undefined;
}

const vec = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const axisOf = (v: Vec3, axis: 0 | 1 | 2) => (axis === 0 ? v.x : axis === 1 ? v.y : v.z);

export class World<E extends WorldEntity> {
  private readonly model: CollisionModel;
  private readonly submodelHeadnode: (modelindex: number) => number | undefined;
  private readonly root: AreaNode<E>;
  private readonly links = new Map<E, Link<E>>();
  private worldEntity: E | null = null;

  constructor(options: WorldOptions) {
    this.model = options.model;
    this.submodelHeadnode = options.submodelHeadnode;
    const world = this.model.bmodels[0];
    this.root = this.createAreaNode(0, world.mins, world.maxs);
  }

  /** The entity traces report when they hit map geometry (edict 0). Must be set before tracing. */
  setWorldEntity(world: E): void {
    this.worldEntity = world;
  }

  /** SV_CreateAreaNode. */
  private createAreaNode(depth: number, mins: Vec3, maxs: Vec3): AreaNode<E> {
    const node: AreaNode<E> = { axis: -1, dist: 0, children: [null, null], solids: new Set(), triggers: new Set() };
    if (depth === AREA_DEPTH) return node;

    const axis: 0 | 1 = maxs.x - mins.x > maxs.y - mins.y ? 0 : 1;
    node.axis = axis;
    node.dist = 0.5 * (axisOf(maxs, axis) + axisOf(mins, axis));
    const maxs1 = axis === 0 ? vec(node.dist, maxs.y, maxs.z) : vec(maxs.x, node.dist, maxs.z);
    const mins2 = axis === 0 ? vec(node.dist, mins.y, mins.z) : vec(mins.x, node.dist, mins.z);
    node.children[0] = this.createAreaNode(depth + 1, mins2, maxs);
    node.children[1] = this.createAreaNode(depth + 1, mins, maxs1);
    return node;
  }

  /** SV_UnlinkEdict: call before an entity is freed or moved out of the world. */
  unlink(ent: E): void {
    const link = this.links.get(ent);
    if (!link) return;
    link.list.delete(ent);
    this.links.delete(ent);
  }

  isLinked(ent: E): boolean {
    return this.links.has(ent);
  }

  linkInfo(ent: E): LinkInfo | undefined {
    return this.links.get(ent)?.info;
  }

  /** SV_LinkEdict: sets size, absmin and absmax, finds the entity's clusters and areas, and files it in the area tree. */
  link(ent: E): void {
    this.unlink(ent);
    if (ent === this.worldEntity || ent.index === 0) return; // the world is not linked
    if (!ent.inUse) return;

    ent.size = vec(ent.maxs.x - ent.mins.x, ent.maxs.y - ent.mins.y, ent.maxs.z - ent.mins.z);

    const { origin, angles } = ent;
    if (ent.solid === Solid.Bsp && (angles.x || angles.y || angles.z)) {
      // A rotated brush model can reach as far as its farthest corner in any direction.
      let max = 0;
      for (const v of [ent.mins.x, ent.mins.y, ent.mins.z, ent.maxs.x, ent.maxs.y, ent.maxs.z]) {
        if (Math.abs(v) > max) max = Math.abs(v);
      }
      ent.absmin = vec(origin.x - max, origin.y - max, origin.z - max);
      ent.absmax = vec(origin.x + max, origin.y + max, origin.z + max);
    } else {
      ent.absmin = vec(origin.x + ent.mins.x, origin.y + ent.mins.y, origin.z + ent.mins.z);
      ent.absmax = vec(origin.x + ent.maxs.x, origin.y + ent.maxs.y, origin.z + ent.maxs.z);
    }
    // Movement is clipped an epsilon away from edges, so check boxes that don't quite touch.
    ent.absmin = vec(ent.absmin.x - 1, ent.absmin.y - 1, ent.absmin.z - 1);
    ent.absmax = vec(ent.absmax.x + 1, ent.absmax.y + 1, ent.absmax.z + 1);

    const info = this.findClusters(ent.absmin, ent.absmax);
    ent.linkcount += 1;

    if (ent.solid === Solid.Not) return;

    let node = this.root;
    while (node.axis !== -1) {
      if (axisOf(ent.absmin, node.axis) > node.dist) node = node.children[0]!;
      else if (axisOf(ent.absmax, node.axis) < node.dist) node = node.children[1]!;
      else break; // crosses the split
    }
    const list = ent.solid === Solid.Trigger ? node.triggers : node.solids;
    list.add(ent);
    this.links.set(ent, { node, list, info });
  }

  private findClusters(absmin: Vec3, absmax: Vec3): LinkInfo {
    const leafs = boxLeafnums(this.model, absmin, absmax, 0, MAX_TOTAL_ENT_LEAFS);
    const clusters: number[] = [];
    let areanum = 0;
    let areanum2 = 0;
    let overflow = false;
    for (const leafIndex of leafs) {
      const leaf = this.model.leaves[leafIndex];
      if (leaf.area) {
        // Doors may straddle two areas; nothing should need more.
        if (areanum && areanum !== leaf.area) areanum2 = leaf.area;
        else areanum = leaf.area;
      }
      if (leaf.cluster === -1) continue;
      if (clusters.includes(leaf.cluster)) continue;
      if (clusters.length === MAX_ENT_CLUSTERS) {
        overflow = true;
        continue;
      }
      clusters.push(leaf.cluster);
    }
    return { clusters, clustersOverflow: overflow || leafs.length >= MAX_TOTAL_ENT_LEAFS, areanum, areanum2 };
  }

  /** SV_AreaEdicts: linked entities of one kind whose boxes touch mins..maxs. */
  areaEdicts(mins: Vec3, maxs: Vec3, type: AreaType): E[] {
    const found: E[] = [];
    const walk = (node: AreaNode<E>) => {
      const list = type === AreaType.Solid ? node.solids : node.triggers;
      for (const check of list) {
        if (check.solid === Solid.Not) continue;
        if (
          check.absmin.x > maxs.x || check.absmin.y > maxs.y || check.absmin.z > maxs.z ||
          check.absmax.x < mins.x || check.absmax.y < mins.y || check.absmax.z < mins.z
        ) {
          continue;
        }
        found.push(check);
      }
      if (node.axis === -1) return;
      if (axisOf(maxs, node.axis) > node.dist) walk(node.children[0]!);
      if (axisOf(mins, node.axis) < node.dist) walk(node.children[1]!);
    };
    walk(this.root);
    return found;
  }

  /** SV_HullForEntity: the submodel for a brush entity, otherwise a box hull of its size. */
  private hullForEntity(ent: E): number {
    if (ent.solid === Solid.Bsp) {
      const headnode = this.submodelHeadnode(ent.modelindex);
      if (headnode === undefined) throw new Error(`Solid.Bsp entity ${ent.index} has modelindex ${ent.modelindex}, which is not a submodel`);
      return headnode;
    }
    return headnodeForBox(this.model, ent.mins, ent.maxs);
  }

  /** SV_PointContents: the world's contents at p, or'd with every solid entity there. */
  pointContents(p: Vec3): number {
    let contents = pointContents(p, this.model, 0);
    for (const hit of this.areaEdicts(p, p, AreaType.Solid)) {
      const headnode = this.hullForEntity(hit);
      contents |= transformedPointContents(p, this.model, headnode, hit.origin, hit.angles);
    }
    return contents;
  }

  /**
   * SV_Trace: moves a box from start to end through the world and its solid entities.
   * passent, things it owns, and its owner are not checked.
   */
  trace(start: Vec3, mins: Vec3 | null, maxs: Vec3 | null, end: Vec3, passent: E | null, contentmask: number): WorldTraceResult<E> {
    const world = this.worldEntity;
    if (!world) throw new Error('World.trace before setWorldEntity');
    const boxMins = mins ?? vec(0, 0, 0);
    const boxMaxs = maxs ?? vec(0, 0, 0);

    let best: WorldTraceResult<E> = {
      ...traceBox({ model: this.model, start, end, mins: boxMins, maxs: boxMaxs, headnode: 0, contentMask: contentmask >>> 0 }),
      ent: world,
    };
    if (best.fraction === 0) return best; // blocked by the world

    // SV_TraceBounds: the box the whole move sweeps, one unit larger.
    const lo = vec(
      Math.min(start.x, end.x) + boxMins.x - 1,
      Math.min(start.y, end.y) + boxMins.y - 1,
      Math.min(start.z, end.z) + boxMins.z - 1,
    );
    const hi = vec(
      Math.max(start.x, end.x) + boxMaxs.x + 1,
      Math.max(start.y, end.y) + boxMaxs.y + 1,
      Math.max(start.z, end.z) + boxMaxs.z + 1,
    );

    // SV_ClipMoveToEntities
    for (const touch of this.areaEdicts(lo, hi, AreaType.Solid)) {
      if (touch.solid === Solid.Not) continue;
      if (touch === passent) continue;
      if (best.allsolid) return best;
      if (passent) {
        if (touch.owner === passent) continue; // own missiles
        if (passent.owner === touch) continue; // owner
      }
      if (!(contentmask & CONTENTS_DEADMONSTER) && touch.svflags & ServerFlags.DeadMonster) continue;

      const headnode = this.hullForEntity(touch);
      const angles = touch.solid === Solid.Bsp ? touch.angles : undefined; // boxes don't rotate
      const t = transformedBoxTrace({
        model: this.model,
        start,
        end,
        mins: boxMins,
        maxs: boxMaxs,
        headnode,
        contentMask: contentmask >>> 0,
        origin: touch.origin,
        angles,
      });

      if (t.allsolid || t.startsolid || t.fraction < best.fraction) {
        best = best.startsolid ? { ...t, ent: touch, startsolid: true } : { ...t, ent: touch };
      } else if (t.startsolid) {
        best = { ...best, startsolid: true };
      }
    }
    return best;
  }
}
