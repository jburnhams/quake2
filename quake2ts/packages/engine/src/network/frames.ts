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
// Until 2026-11-26 the network clients applied every packet to one running entity map, ignored
// removals and the delta frame, which only worked while the server deltaed from the last frame it
// sent whether or not it arrived.
import { UPDATE_BACKUP } from '@quake2ts/shared';
import { applyEntityDelta } from '../demo/delta.js';
import { createEmptyEntityState, type EntityState, type FrameData } from '../demo/state.js';

/** One parsed server frame. */
export interface ClientFrame {
  readonly serverFrame: number;
  readonly deltaFrame: number;
  /** False when the frame it deltas from was gone: its entities are not to be trusted. */
  readonly valid: boolean;
  /** Every entity in the frame, by number, whole (not deltas). */
  readonly entities: ReadonlyMap<number, EntityState>;
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

    const parsed: ClientFrame = { serverFrame: frame.serverFrame, deltaFrame: frame.deltaFrame, valid, entities };
    this.frames[frame.serverFrame & (UPDATE_BACKUP - 1)] = parsed;
    this.current = parsed;
    return parsed;
  }
}
