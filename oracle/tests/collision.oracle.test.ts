/**
 * Differential tests: the TS collision code against id Software's cmodel.c.
 *
 * The same seeded random queries go to both; every answer must match within
 * float tolerance. A failure prints the first differing cases so they can be
 * added to the regression list below.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp, collisionModelFromBsp } from '@quake2ts/engine';
import {
  traceBox,
  pointContents,
  transformedBoxTrace,
  transformedPointContents,
  headnodeForBox,
  RandomGenerator,
  MASK_ALL,
  MASK_SOLID,
  MASK_PLAYERSOLID,
  MASK_SHOT,
  MASK_WATER,
  type CollisionModel,
  type Vec3,
} from '@quake2ts/shared';
import { buildOracle, extractMap, runOracle, type OracleQuery, type OracleTrace } from './oracle';

const MAPS = ['maps/demo1.bsp'];
const SEED = 0x5eed;
const QUERIES = Number(process.env.ORACLE_QUERIES ?? 20000);

const BOXES: ReadonlyArray<[Vec3, Vec3]> = [
  [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }], // point (bullets, sight lines)
  [{ x: -16, y: -16, z: -24 }, { x: 16, y: 16, z: 32 }], // standing player
  [{ x: -16, y: -16, z: -24 }, { x: 16, y: 16, z: 4 }], // crouched player
  [{ x: -4, y: -4, z: -4 }, { x: 4, y: 4, z: 4 }], // projectile
];
const MASKS = [MASK_ALL, MASK_SOLID, MASK_PLAYERSOLID, MASK_SHOT];

interface Diff {
  query: OracleQuery;
  ts: unknown;
  c: unknown;
  why: string;
}

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

/** Guards against a generator that only makes misses, which would compare nothing. */
function expectSomeHits(answers: OracleTrace[]): void {
  const hits = answers.filter((a) => a.fraction < 1 || a.startsolid).length;
  expect(hits / answers.length).toBeGreaterThan(0.15);
}

function compareTrace(ts: ReturnType<typeof traceBox>, c: OracleTrace): string | null {
  if (ts.startsolid !== c.startsolid) return 'startsolid';
  if (ts.allsolid !== c.allsolid) return 'allsolid';
  if (!close(ts.fraction, c.fraction, 1e-3)) return 'fraction';
  if (!close(ts.endpos.x, c.endpos[0], 0.1) || !close(ts.endpos.y, c.endpos[1], 0.1) || !close(ts.endpos.z, c.endpos[2], 0.1)) {
    return 'endpos';
  }
  if (c.fraction < 1 && !c.allsolid) {
    const n = ts.plane?.normal;
    if (!n || !close(n.x, c.normal[0], 1e-3) || !close(n.y, c.normal[1], 1e-3) || !close(n.z, c.normal[2], 1e-3)) {
      return 'plane';
    }
    if ((ts.contents ?? 0) !== c.contents) return 'contents';
  }
  return null;
}

function summarize(diffs: Diff[], total: number): string {
  const byWhy = new Map<string, number>();
  for (const d of diffs) byWhy.set(d.why, (byWhy.get(d.why) ?? 0) + 1);
  const head = [...byWhy].map(([k, v]) => `${k}: ${v}`).join(', ');
  const samples = diffs.slice(0, 5).map((d) => JSON.stringify({ why: d.why, query: d.query, ts: d.ts, c: d.c })).join('\n');
  return `${diffs.length} of ${total} differ (${head})\n${samples}`;
}

describe.each(MAPS)('collision matches cmodel.c on %s', (mapPath) => {
  let bin: string;
  let file: string;
  let model: CollisionModel;
  let worldMins: Vec3;
  let worldMaxs: Vec3;

  beforeAll(() => {
    bin = buildOracle();
    const map = extractMap(mapPath);
    file = map.file;
    const bsp = parseBsp(map.data);
    model = collisionModelFromBsp(bsp);
    worldMins = model.bmodels[0].mins;
    worldMaxs = model.bmodels[0].maxs;
  });

  // Inputs are rounded to float32 because the C side stores them as floats; without this,
  // a segment that grazes a brush corner can hit on one side and miss on the other.
  const f32 = (v: Vec3): Vec3 => ({ x: Math.fround(v.x), y: Math.fround(v.y), z: Math.fround(v.z) });
  const randomPoint = (rng: RandomGenerator): Vec3 =>
    f32({
      x: rng.frandomRange(worldMins.x, worldMaxs.x),
      y: rng.frandomRange(worldMins.y, worldMaxs.y),
      z: rng.frandomRange(worldMins.z, worldMaxs.z),
    });

  it('point contents', () => {
    const rng = new RandomGenerator({ seed: SEED });
    const queries: OracleQuery[] = [];
    for (let i = 0; i < QUERIES; i++) queries.push({ op: 'contents', point: randomPoint(rng), headnode: 0 });
    const answers = runOracle(bin, file, queries);
    const diffs: Diff[] = [];
    queries.forEach((q, i) => {
      if (q.op !== 'contents') return;
      const ts = pointContents(q.point, model, 0);
      if (ts !== answers[i].contents) diffs.push({ query: q, ts, c: answers[i].contents, why: 'contents' });
    });
    expect(diffs, summarize(diffs, queries.length)).toHaveLength(0);
  });

  it('box traces', () => {
    const rng = new RandomGenerator({ seed: SEED + 1 });
    const queries: OracleQuery[] = [];
    for (let i = 0; i < QUERIES; i++) {
      const start = randomPoint(rng);
      // Mostly short moves like a frame of movement, some long ones like a hitscan.
      // Every 10th query is a position test (start == end), which cmodel.c handles separately.
      const reach = i % 10 === 9 ? 0 : i % 4 === 0 ? 2048 : 64;
      const end = f32({
        x: start.x + rng.crandom() * reach,
        y: start.y + rng.crandom() * reach,
        z: start.z + rng.crandom() * reach,
      });
      const [mins, maxs] = BOXES[i % BOXES.length];
      queries.push({ op: 'trace', start, end, mins, maxs, mask: MASKS[(i >> 2) % MASKS.length], headnode: 0 });
    }
    const answers = runOracle(bin, file, queries) as OracleTrace[];
    const diffs: Diff[] = [];
    queries.forEach((q, i) => {
      if (q.op !== 'trace') return;
      const ts = traceBox({ model, start: q.start, end: q.end, mins: q.mins, maxs: q.maxs, contentMask: q.mask >>> 0, headnode: 0 });
      const why = compareTrace(ts, answers[i]);
      if (why) diffs.push({ query: q, ts: { fraction: ts.fraction, endpos: ts.endpos, startsolid: ts.startsolid, allsolid: ts.allsolid, normal: ts.plane?.normal }, c: answers[i], why });
    });
    expect(diffs, summarize(diffs, queries.length)).toHaveLength(0);
  });

  // Doors, plats and other brush entities: their submodel moved to an origin and turned.
  // Moves start near the submodel so most of them touch it.
  const nearSubmodel = (rng: RandomGenerator, i: number, origin: Vec3, slack: number): Vec3 => {
    const b = model.bmodels[i];
    return f32({
      x: origin.x + rng.frandomRange(b.mins.x - slack, b.maxs.x + slack),
      y: origin.y + rng.frandomRange(b.mins.y - slack, b.maxs.y + slack),
      z: origin.z + rng.frandomRange(b.mins.z - slack, b.maxs.z + slack),
    });
  };
  const randomPlacement = (rng: RandomGenerator, i: number): { origin: Vec3; angles: Vec3 } => {
    const origin = f32({ x: rng.crandom() * 64, y: rng.crandom() * 64, z: rng.crandom() * 64 });
    // A third unrotated (doors, plats), a third turned about z (rotating doors), a third any way.
    const kind = i % 3;
    const angles = f32(
      kind === 0
        ? { x: 0, y: 0, z: 0 }
        : kind === 1
          ? { x: 0, y: rng.frandomRange(0, 360), z: 0 }
          : { x: rng.frandomRange(-90, 90), y: rng.frandomRange(0, 360), z: rng.frandomRange(-45, 45) },
    );
    return { origin, angles };
  };

  it('submodel traces', () => {
    const rng = new RandomGenerator({ seed: SEED + 2 });
    const submodels = model.bmodels.length - 1;
    expect(submodels).toBeGreaterThan(0);
    const queries: OracleQuery[] = [];
    for (let i = 0; i < QUERIES / 4; i++) {
      const index = 1 + (i % submodels);
      const { origin, angles } = randomPlacement(rng, i);
      const start = nearSubmodel(rng, index, origin, 48);
      // Half the moves aim into the submodel's bounds, so plenty of them hit.
      const reach = i % 10 === 9 ? 0 : 96;
      const end =
        i % 2 === 0
          ? nearSubmodel(rng, index, origin, 0)
          : f32({ x: start.x + rng.crandom() * reach, y: start.y + rng.crandom() * reach, z: start.z + rng.crandom() * reach });
      const [mins, maxs] = BOXES[i % BOXES.length];
      queries.push({ op: 'ttrace', start, end, mins, maxs, mask: MASKS[(i >> 2) % MASKS.length], headnode: model.bmodels[index].headnode, origin, angles });
    }
    const answers = runOracle(bin, file, queries) as OracleTrace[];
    const diffs: Diff[] = [];
    queries.forEach((q, i) => {
      if (q.op !== 'ttrace') return;
      const ts = transformedBoxTrace({ model, start: q.start, end: q.end, mins: q.mins, maxs: q.maxs, contentMask: q.mask >>> 0, headnode: q.headnode, origin: q.origin, angles: q.angles });
      const why = compareTrace(ts, answers[i]);
      if (why) diffs.push({ query: q, ts: { fraction: ts.fraction, endpos: ts.endpos, startsolid: ts.startsolid, allsolid: ts.allsolid, normal: ts.plane?.normal }, c: answers[i], why });
    });
    expect(diffs, summarize(diffs, queries.length)).toHaveLength(0);
    expectSomeHits(answers);
  });

  it('submodel point contents', () => {
    const rng = new RandomGenerator({ seed: SEED + 3 });
    const submodels = model.bmodels.length - 1;
    const queries: OracleQuery[] = [];
    for (let i = 0; i < QUERIES / 4; i++) {
      const index = 1 + (i % submodels);
      const { origin, angles } = randomPlacement(rng, i);
      queries.push({ op: 'tcontents', point: nearSubmodel(rng, index, origin, 16), headnode: model.bmodels[index].headnode, origin, angles });
    }
    const answers = runOracle(bin, file, queries);
    const diffs: Diff[] = [];
    queries.forEach((q, i) => {
      if (q.op !== 'tcontents') return;
      const ts = transformedPointContents(q.point, model, q.headnode, q.origin, q.angles);
      if (ts !== answers[i].contents) diffs.push({ query: q, ts, c: answers[i].contents, why: 'contents' });
    });
    expect(diffs, summarize(diffs, queries.length)).toHaveLength(0);
  });

  // Monsters, players and items: a bounding box turned into a six-plane hull.
  it('box hull traces', () => {
    const rng = new RandomGenerator({ seed: SEED + 4 });
    const queries: OracleQuery[] = [];
    for (let i = 0; i < QUERIES / 4; i++) {
      const [boxMins, boxMaxs] = BOXES[1 + (i % 3)];
      const origin = randomPoint(rng);
      const start = f32({ x: origin.x + rng.crandom() * 64, y: origin.y + rng.crandom() * 64, z: origin.z + rng.crandom() * 64 });
      // Half the moves aim at the box, so plenty of them hit.
      const reach = i % 10 === 9 ? 0 : 96;
      const end =
        i % 2 === 0
          ? f32({ x: origin.x + rng.crandom() * 8, y: origin.y + rng.crandom() * 8, z: origin.z + rng.crandom() * 8 })
          : f32({ x: start.x + rng.crandom() * reach, y: start.y + rng.crandom() * reach, z: start.z + rng.crandom() * reach });
      const [mins, maxs] = BOXES[i % BOXES.length];
      queries.push({ op: 'btrace', start, end, mins, maxs, mask: MASKS[(i >> 2) % MASKS.length], boxMins, boxMaxs, origin });
    }
    const answers = runOracle(bin, file, queries) as OracleTrace[];
    const diffs: Diff[] = [];
    queries.forEach((q, i) => {
      if (q.op !== 'btrace') return;
      const headnode = headnodeForBox(model, q.boxMins, q.boxMaxs);
      const ts = transformedBoxTrace({ model, start: q.start, end: q.end, mins: q.mins, maxs: q.maxs, contentMask: q.mask >>> 0, headnode, origin: q.origin });
      const why = compareTrace(ts, answers[i]);
      if (why) diffs.push({ query: q, ts: { fraction: ts.fraction, endpos: ts.endpos, startsolid: ts.startsolid, allsolid: ts.allsolid, normal: ts.plane?.normal }, c: answers[i], why });
    });
    expect(diffs, summarize(diffs, queries.length)).toHaveLength(0);
    expectSomeHits(answers);
  });
});
