// The client's frames, as CL_ParseFrame and CL_ParsePacketEntities (client/cl_ents.c) keep them.
//
// A server frame is a delta from an older frame the client said it had (its clc_move `lastframe`),
// not from the frame before it: under latency that is a few frames back, and after a lost packet
// it skips the lost one. So the client keeps the last UPDATE_BACKUP frames, starts each new one
// from the entities of the frame it names, and applies the packet's deltas and removals to that.
// An entity the old frame lacks is a delta from its baseline. If the named frame is no longer
// held, the new frame is invalid: the client draws nothing new from it and sends `lastframe` -1,
// so the server sends a whole frame next.
//
// The player state is a delta from the same frame's (CL_ParsePlayerstate), so it is kept here too.
//
// Until 2026-11-26 the network clients applied every packet to one running entity map, ignored
// removals and the delta frame, which only worked while the server deltaed from the last frame it
// sent whether or not it arrived.
import { UPDATE_BACKUP } from '@quake2ts/shared';
import { applyEntityDelta } from '../demo/delta.js';
import {
  createEmptyEntityState,
  createEmptyProtocolPlayerState,
  type EntityState,
  type FrameData,
  type ProtocolPlayerState,
} from '../demo/state.js';

/** One parsed server frame. */
export interface ClientFrame {
  readonly serverFrame: number;
  readonly deltaFrame: number;
  /** False when the frame it deltas from was gone: its entities are not to be trusted. */
  readonly valid: boolean;
  /** Every entity in the frame, by number, whole (not deltas). */
  readonly entities: ReadonlyMap<number, EntityState>;
  /** The player state, whole: the delta frame's with the fields this packet carried. */
  readonly playerState: ProtocolPlayerState;
}

const cloneEntity = (e: EntityState): EntityState => ({
  ...e,
  origin: { ...e.origin },
  old_origin: { ...e.old_origin },
  angles: { ...e.angles },
});

/**
 * MSG_ReadDeltaEntity's start: the old state, with old_origin set to where it was and the
 * event cleared (events are not delta compressed), then the fields the packet carries.
 */
export function deltaEntity(from: EntityState, partial: EntityState): EntityState {
  const to = cloneEntity(from);
  to.old_origin = { ...from.origin };
  to.event = 0;
  applyEntityDelta(to, partial);
  to.number = partial.number;
  return to;
}

const vec = (v: { x: number; y: number; z: number }) => ({ x: v.x, y: v.y, z: v.z });

const clonePlayerState = (ps: ProtocolPlayerState): ProtocolPlayerState => ({
  ...ps,
  origin: vec(ps.origin),
  velocity: vec(ps.velocity),
  delta_angles: vec(ps.delta_angles),
  viewoffset: vec(ps.viewoffset),
  viewangles: vec(ps.viewangles),
  kick_angles: vec(ps.kick_angles),
  gun_offset: vec(ps.gun_offset),
  gun_angles: vec(ps.gun_angles),
  blend: [...(ps.blend ?? [0, 0, 0, 0])],
  stats: [...(ps.stats ?? [])],
  damage_blend: [...(ps.damage_blend ?? [0, 0, 0, 0])],
});

/**
 * CL_ParsePlayerstate: the delta frame's state with the fields the packet carried (its `bits` and
 * `statbits`). A state with no bits was built whole, not read, and is taken as it is.
 */
export function deltaPlayerState(from: ProtocolPlayerState, read: ProtocolPlayerState): ProtocolPlayerState {
  if (!read) return clonePlayerState(from);
  if (read.bits === undefined) return clonePlayerState(read);
  const flags = read.bits;
  const to = clonePlayerState(from);
  if (flags & 1) to.pm_type = read.pm_type;
  if (flags & 2) to.origin = vec(read.origin);
  if (flags & 4) to.velocity = vec(read.velocity);
  if (flags & 8) to.pm_time = read.pm_time;
  if (flags & 16) to.pm_flags = read.pm_flags;
  if (flags & 32) to.gravity = read.gravity;
  if (flags & 64) to.delta_angles = vec(read.delta_angles);
  if (flags & 128) to.viewoffset = vec(read.viewoffset);
  if (flags & 256) to.viewangles = vec(read.viewangles);
  if (flags & 512) to.kick_angles = vec(read.kick_angles);
  if (flags & 4096) to.gun_index = read.gun_index;
  if (flags & 8192) {
    to.gun_frame = read.gun_frame;
    to.gun_offset = vec(read.gun_offset);
    to.gun_angles = vec(read.gun_angles);
  }
  if (flags & 1024) to.blend = [...read.blend];
  if (flags & 2048) to.fov = read.fov;
  if (flags & 16384) to.rdflags = read.rdflags;
  if (flags & 32768) to.watertype = read.watertype;
  const statbits = read.statbits ?? 0;
  for (let i = 0; i < 32; i++) if (statbits & (1 << i)) to.stats[i] = read.stats[i];
  to.bits = read.bits;
  to.statbits = read.statbits;
  return to;
}

/**
 * A frame's entities as copies, for code that draws or changes them: the frames keep their own,
 * which later frames delta from.
 */
export function copyEntities(frame: ClientFrame): Map<number, EntityState> {
  const copy = new Map<number, EntityState>();
  for (const [number, entity] of frame.entities) copy.set(number, cloneEntity(entity));
  return copy;
}

/** The last UPDATE_BACKUP frames, by serverFrame & (UPDATE_BACKUP - 1), as cl.frames holds them. */
export class ClientFrames {
  private readonly frames: (ClientFrame | undefined)[] = new Array(UPDATE_BACKUP);
  private current: ClientFrame | undefined;

  reset(): void {
    this.frames.fill(undefined);
    this.current = undefined;
  }

  /** The newest frame parsed, valid or not (cl.frame). */
  get latest(): ClientFrame | undefined {
    return this.current;
  }

  /** What clc_move tells the server the client has: the newest frame if it is valid, else -1. */
  get acknowledged(): number {
    return this.current?.valid ? this.current.serverFrame : -1;
  }

  /** Builds a frame from the frame it names and the baselines (CL_ParseFrame), and keeps it. */
  parse(frame: FrameData, baselines: ReadonlyMap<number, EntityState>): ClientFrame {
    let old: ClientFrame | undefined;
    let valid = false;
    if (frame.deltaFrame <= 0) {
      valid = true;
    } else {
      old = this.frames[frame.deltaFrame & (UPDATE_BACKUP - 1)];
      // "Delta frame too old": the slot has been reused by a later frame, or never filled.
      if (old && old.serverFrame === frame.deltaFrame) valid = true;
      else old = undefined;
    }

    // CL_ParsePacketEntities: the old frame's entities, less the removed, with the deltas applied.
    const entities = new Map<number, EntityState>(old?.entities ?? []);
    for (const number of frame.packetEntities.removed ?? []) entities.delete(number);
    for (const partial of frame.packetEntities.entities) {
      const from = entities.get(partial.number) ?? baselines.get(partial.number) ?? createEmptyEntityState();
      entities.set(partial.number, deltaEntity(from, partial));
    }

    // CL_ParsePlayerstate: from the delta frame's player state, or from zero for a whole frame.
    const playerState = deltaPlayerState(old?.playerState ?? createEmptyProtocolPlayerState(), frame.playerState);

    const parsed: ClientFrame = {
      serverFrame: frame.serverFrame,
      deltaFrame: frame.deltaFrame,
      valid,
      entities,
      playerState,
    };
    this.frames[frame.serverFrame & (UPDATE_BACKUP - 1)] = parsed;
    this.current = parsed;
    return parsed;
  }
}
