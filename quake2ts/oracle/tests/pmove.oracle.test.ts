/**
 * Differential tests: the TS player movement (runPmove) against the rerelease's p_move.cpp.
 *
 * Seeded random trajectories on demo1: a start on a floor, in the air or in water, then a run
 * of frames with held commands (walk, strafe, jump, crouch, turn) at several frame lengths.
 * Every frame starts both sides from the C side's previous result, so a difference is that
 * frame's own and does not snowball. Traces on both sides are the world's (cmodel.c for C,
 * the TS collision code for TS; those two are held equal by collision.oracle.test.ts).
 */
import { writeFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp, collisionModelFromBsp } from '@quake2ts/engine';
import {
  traceBox,
  pointContents,
  runPmove,
  RandomGenerator,
  MASK_PLAYERSOLID,
  CONTENTS_WATER,
  CONTENTS_SLIME,
  CONTENTS_LAVA,
  type CollisionModel,
  type PmoveState,
  type Vec3,
} from '@quake2ts/shared';
import { extractMap, pmoveOracleBin, runOracleLines } from './oracle';

const MAP = 'maps/demo1.bsp';
const SEED = 0x9a0e;
const TRAJECTORIES = Number(process.env.ORACLE_PMOVE_RUNS ?? 400);
const FRAMES = 40;

const BUTTON_JUMP = 1 << 3;
const BUTTON_CROUCH = 1 << 4;
const PLAYER_MINS: Vec3 = { x: -16, y: -16, z: -24 };
const PLAYER_MAXS: Vec3 = { x: 16, y: 16, z: 32 };
const LIQUID = CONTENTS_WATER | CONTENTS_SLIME | CONTENTS_LAVA;

interface CState {
  origin: [number, number, number];
  velocity: [number, number, number];
  pmFlags: number;
  pmTime: number;
  viewheight: number;
  viewangles: [number, number, number];
  mins: [number, number, number];
  maxs: [number, number, number];
  onGround: boolean;
  watertype: number;
  waterlevel: number;
  jumpSound: boolean;
  stepClip: boolean;
  impactDelta: number;
  touch: number;
}

interface Cmd {
  msec: number;
  buttons: number;
  angles: Vec3;
  forwardmove: number;
  sidemove: number;
}

interface Frame {
  start: CState;
  cmd: Cmd;
  c: CState;
}

const f32 = (v: Vec3): Vec3 => ({ x: Math.fround(v.x), y: Math.fround(v.y), z: Math.fround(v.z) });
const vec = (a: [number, number, number]): Vec3 => ({ x: a[0], y: a[1], z: a[2] });
const fmt = (v: Vec3) => `${v.x} ${v.y} ${v.z}`;

describe(`player movement matches rerelease p_move.cpp on ${MAP}`, () => {
  let bin: string;
  let file: string;
  let model: CollisionModel;

  beforeAll(() => {
    bin = pmoveOracleBin();
    const map = extractMap(MAP);
    file = map.file;
    model = collisionModelFromBsp(parseBsp(map.data));
  });

  const trace = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3) =>
    traceBox({ model, start, end, mins, maxs, contentMask: MASK_PLAYERSOLID, headnode: 0 });

  /** A place a standing player fits: on a floor, in the air, or in a liquid. */
  function randomStart(rng: RandomGenerator, kind: number): Vec3 | null {
    const w = model.bmodels[0];
    for (let tries = 0; tries < 200; tries++) {
      const p = f32({
        x: rng.frandomRange(w.mins.x, w.maxs.x),
        y: rng.frandomRange(w.mins.y, w.maxs.y),
        z: rng.frandomRange(w.mins.z, w.maxs.z),
      });
      const c = pointContents(p, model, 0);
      if (kind === 2 ? (c & LIQUID) === 0 : c !== 0) continue;
      if (trace(p, p, PLAYER_MINS, PLAYER_MAXS).startsolid) continue;
      if (kind !== 0) return p;
      const down = trace(p, { ...p, z: p.z - 1024 }, PLAYER_MINS, PLAYER_MAXS);
      if (down.fraction === 1 || down.startsolid) continue;
      return f32(down.endpos);
    }
    return null;
  }

  function randomCmd(rng: RandomGenerator): Cmd {
    const move = () => (rng.frandom() < 0.3 ? 0 : Math.round(rng.crandom() * 400));
    const r = rng.frandom();
    const buttons = r < 0.2 ? BUTTON_JUMP : r < 0.3 ? BUTTON_CROUCH : r < 0.33 ? BUTTON_JUMP | BUTTON_CROUCH : 0;
    const msecs = [25, 25, 25, 16, 8, 33, 50];
    return {
      msec: msecs[rng.irandom(msecs.length)],
      buttons,
      angles: f32({ x: rng.crandom() * 80, y: rng.frandomRange(-180, 180), z: 0 }),
      forwardmove: move(),
      sidemove: move(),
    };
  }

  /** Runs every trajectory through the C side and returns each frame with its start state. */
  function runC(rng: RandomGenerator): Frame[] {
    const lines: string[] = [];
    const plan: { start: CState | null; cmd: Cmd }[] = [];
    for (let t = 0; t < TRAJECTORIES; t++) {
      const kind = t % 10 < 6 ? 0 : t % 10 < 9 ? 1 : 2;
      const origin = randomStart(rng, kind);
      if (!origin) continue;
      const velocity = f32(kind === 0 ? { x: 0, y: 0, z: 0 } : { x: rng.crandom() * 300, y: rng.crandom() * 300, z: rng.crandom() * 300 });
      lines.push(`state 0 ${fmt(origin)} ${fmt(velocity)} 0 0 800 0 0 0`);
      const initial: CState = {
        origin: [origin.x, origin.y, origin.z],
        velocity: [velocity.x, velocity.y, velocity.z],
        pmFlags: 0,
        pmTime: 0,
        viewheight: 22,
        viewangles: [0, 0, 0],
        mins: [-16, -16, -24],
        maxs: [16, 16, 32],
        onGround: false,
        watertype: 0,
        waterlevel: 0,
        jumpSound: false,
        stepClip: false,
        impactDelta: 0,
        touch: 0,
      };
      plan.push({ start: initial, cmd: null as unknown as Cmd });
      let cmd = randomCmd(rng);
      for (let i = 0; i < FRAMES; i++) {
        if (rng.frandom() < 0.15) cmd = randomCmd(rng);
        lines.push(`move ${cmd.msec} ${cmd.buttons} ${fmt(cmd.angles)} ${cmd.forwardmove} ${cmd.sidemove} 0`);
        plan.push({ start: null, cmd });
      }
    }
    const answers = runOracleLines(bin, [file], lines);
    const frames: Frame[] = [];
    let prev: CState | null = null;
    plan.forEach((p, i) => {
      if (p.start) {
        prev = p.start;
        return;
      }
      const c = answers[i] as CState;
      frames.push({ start: prev!, cmd: p.cmd, c });
      prev = c;
    });
    return frames;
  }

  function runTs(f: Frame): PmoveState {
    const s = f.start;
    const up = f.cmd.buttons & BUTTON_JUMP ? 200 : f.cmd.buttons & BUTTON_CROUCH ? -200 : 0;
    const state: PmoveState = {
      pmType: 0,
      pmFlags: s.pmFlags,
      pmTime: s.pmTime,
      origin: vec(s.origin),
      velocity: vec(s.velocity),
      angles: { x: 0, y: 0, z: 0 },
      viewAngles: f.cmd.angles,
      viewHeight: s.viewheight,
      waterlevel: s.waterlevel,
      watertype: s.watertype,
      cmd: {
        forwardmove: f.cmd.forwardmove,
        sidemove: f.cmd.sidemove,
        upmove: up,
        buttons: f.cmd.buttons,
        angles: f.cmd.angles,
        msec: f.cmd.msec,
      },
      delta_angles: { x: 0, y: 0, z: 0 },
      gravity: 800,
      mins: vec(s.mins),
      maxs: vec(s.maxs),
    };
    return runPmove(state, {
      trace: (start, end, mins, maxs, mask) => {
        const tr = traceBox({ model, start, end, mins, maxs, contentMask: (mask ?? MASK_PLAYERSOLID) >>> 0, headnode: 0 });
        return {
          fraction: tr.fraction,
          endpos: tr.endpos,
          planeNormal: tr.plane?.normal,
          allsolid: tr.allsolid,
          startsolid: tr.startsolid,
          contents: tr.contents,
          surfaceFlags: tr.surfaceFlags,
          ent: 'world',
        };
      },
      pointcontents: (p) => pointContents(p, model, 0),
    });
  }

  const near = (a: Vec3, b: [number, number, number], tol: number) =>
    Math.abs(a.x - b[0]) <= tol && Math.abs(a.y - b[1]) <= tol && Math.abs(a.z - b[2]) <= tol;

  function compare(ts: PmoveState, c: CState): string[] {
    const why: string[] = [];
    if (!near(ts.origin, c.origin, 0.05)) why.push('origin');
    if (!near(ts.velocity, c.velocity, 0.05)) why.push('velocity');
    if (ts.pmFlags !== c.pmFlags) why.push('pmFlags');
    if ((ts.pmTime ?? 0) !== c.pmTime) why.push('pmTime');
    if (!!ts.onGround !== c.onGround) why.push('onGround');
    if (!!ts.jumpSound !== c.jumpSound) why.push('jumpSound');
    if (!!ts.stepClip !== c.stepClip) why.push('stepClip');
    if (Math.abs((ts.impactDelta ?? 0) - c.impactDelta) > 0.05) why.push('impactDelta');
    if ((ts.touch?.length ?? 0) !== c.touch) why.push('touch');
    if (!near(ts.viewAngles, c.viewangles, 1e-3)) why.push('viewangles');
    if (ts.viewHeight !== c.viewheight) why.push('viewheight');
    if (!near(ts.mins, c.mins, 0) || !near(ts.maxs, c.maxs, 0)) why.push('bounds');
    if (ts.waterlevel !== c.waterlevel) why.push('waterlevel');
    if (ts.watertype !== c.watertype) why.push('watertype');
    return why;
  }

  it('matches frame by frame', () => {
    const frames = runC(new RandomGenerator({ seed: SEED }));
    expect(frames.length).toBeGreaterThan(TRAJECTORIES * FRAMES * 0.9);
    // Guard: the sample must exercise ground, air and water moves.
    expect(frames.filter((f) => f.c.onGround).length / frames.length).toBeGreaterThan(0.3);
    expect(frames.filter((f) => !f.c.onGround).length / frames.length).toBeGreaterThan(0.1);
    expect(frames.some((f) => f.c.waterlevel >= 2)).toBe(true);

    const byWhy = new Map<string, number>();
    const samples: string[] = [];
    let bad = 0;
    const dump: unknown[] = [];
    for (const f of frames) {
      const ts = runTs(f);
      const why = compare(ts, f.c);
      if (why.length === 0) continue;
      bad++;
      dump.push({ why, ...f });
      for (const w of why) byWhy.set(w, (byWhy.get(w) ?? 0) + 1);
      if (samples.length < 6) {
        samples.push(
          JSON.stringify({
            why,
            start: f.start,
            cmd: f.cmd,
            c: f.c,
            ts: { origin: ts.origin, velocity: ts.velocity, pmFlags: ts.pmFlags, pmTime: ts.pmTime, onGround: ts.onGround, jumpSound: ts.jumpSound, stepClip: ts.stepClip, impactDelta: ts.impactDelta, touch: ts.touch?.length, viewHeight: ts.viewHeight, waterlevel: ts.waterlevel, watertype: ts.watertype, mins: ts.mins, maxs: ts.maxs },
          }),
        );
      }
    }
    if (process.env.ORACLE_DUMP) writeFileSync(process.env.ORACLE_DUMP, JSON.stringify(dump));
    const summary = `${bad} of ${frames.length} frames differ (${[...byWhy].map(([k, v]) => `${k}: ${v}`).join(', ')})\n${samples.join('\n')}`;
    expect(bad, summary).toBe(0);
  });
});
