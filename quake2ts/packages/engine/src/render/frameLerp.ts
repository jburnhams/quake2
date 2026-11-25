/**
 * Smooth animation between MD2 frames, for a source that only knows each entity's current frame
 * (a game running in the same process, as /play's LocalHost is).
 *
 * The original client blends from the frame an entity had in the previous server frame
 * (`ent.oldframe = cent->prev.frame; ent.backlerp = 1.0 - cl.lerpfrac`, cl_ents.c), which works
 * because its server frames are 100 ms apart, the same as an animation step. The rerelease's
 * server runs at 40 Hz while monsters and weapons still step their animation at 10 Hz
 * (Weapon_AnimationTime, ps.gunrate 10), so blending between 25 ms server frames would hold a
 * frame for three frames and jump in the fourth. This times each entity's last frame change
 * instead and blends from the frame before it over one animation step.
 */

/** One animation step: monsters think and weapons animate at 10 Hz. */
export const ANIMATION_STEP_MS = 100;

/** What to blend from and how far: draw `oldFrame` blended toward the current frame by `frameLerp` (0 to 1). */
export interface FrameBlendSample {
  readonly oldFrame: number;
  readonly frameLerp: number;
}

interface Entry {
  model: number;
  frame: number;
  oldFrame: number;
  changedMs: number;
  /** Time between the last two frame changes, so a faster animation blends over its own step. */
  intervalMs: number;
}

export class FrameLerpTracker {
  private readonly entries = new Map<number, Entry>();
  private readonly seen = new Set<number>();

  /**
   * The blend for an entity this frame. `key` names the entity (its number), `model` its model
   * index: a new model (a weapon change, a slot reused by another entity) starts without a blend,
   * as CL_AddViewWeapon sets `gun.oldframe = 0` "just changed weapons, don't lerp from old".
   * `stepMs` is how long the animation step lasts (1000 / ps.gunrate for the weapon); an
   * entity seen changing frames faster blends over the interval it is changing at.
   */
  sample(key: number, model: number, frame: number, nowMs: number, stepMs = ANIMATION_STEP_MS): FrameBlendSample {
    this.seen.add(key);
    let entry = this.entries.get(key);
    if (!entry || entry.model !== model || nowMs < entry.changedMs) {
      entry = { model, frame, oldFrame: frame, changedMs: Number.NEGATIVE_INFINITY, intervalMs: Number.POSITIVE_INFINITY };
      this.entries.set(key, entry);
    } else if (entry.frame !== frame) {
      entry.intervalMs = nowMs - entry.changedMs;
      entry.oldFrame = entry.frame;
      entry.frame = frame;
      entry.changedMs = nowMs;
    }
    // A weapon under Haste or Quad Fire steps every 50 or 25 ms (Weapon_AnimationTime): blend
    // over the interval it is actually stepping at when that is shorter, so each blend finishes
    // before the next step instead of snapping.
    const step = Math.min(stepMs, entry.intervalMs);
    const t = step > 0 ? (nowMs - entry.changedMs) / step : 1;
    if (!(t < 1)) return { oldFrame: frame, frameLerp: 1 };
    return { oldFrame: entry.oldFrame, frameLerp: Math.max(0, t) };
  }

  /** Forgets entities not sampled since the last call, so a freed slot does not blend from its old occupant. */
  endFrame(): void {
    for (const key of this.entries.keys()) if (!this.seen.has(key)) this.entries.delete(key);
    this.seen.clear();
  }

  clear(): void {
    this.entries.clear();
    this.seen.clear();
  }
}
