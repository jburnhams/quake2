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
});
