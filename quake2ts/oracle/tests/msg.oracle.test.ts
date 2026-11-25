/**
 * Differential tests: message encoding and checksums against id Software's qcommon/common.c,
 * crc.c and the client's delta reader (client/cl_ents.c).
 *
 * - coordinates, angles and directions: the bytes BinaryWriter puts out against MSG_Write*,
 *   and BinaryStream.readDir against MSG_ReadDir;
 * - CRC_Block and COM_BlockSequenceCRCByte (the clc_move checksum) against crcBlock and
 *   blockSequenceCrcByte;
 * - entity deltas: shared writeDeltaEntity's bytes against MSG_WriteDeltaEntity for random
 *   protocol 34 states, and the demo parser's reader (Quake2ProtocolHandler) against
 *   CL_ParseDelta on the C's bytes, and the demo writer (MessageWriter, protocol 34) too.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import {
  BinaryWriter,
  BinaryStream,
  RandomGenerator,
  writeDeltaEntity,
  crcBlock,
  blockSequenceCrcByte,
  type EntityState,
} from '@quake2ts/shared';
import { createEmptyEntityState } from '@quake2ts/engine';
import { Quake2ProtocolHandler } from '../../packages/engine/src/demo/protocol/quake2';
import { MessageWriter } from '../../packages/engine/src/demo/writer';
import { StreamingBuffer } from '../../packages/engine/src/stream/streamingBuffer';
import { msgOracleBin, runOracleLines } from './oracle';

const SEED = 0x3e55;
const N = Number(process.env.ORACLE_MSG_QUERIES ?? 5000);

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const fromHex = (h: string) => new Uint8Array(h.match(/../g)?.map((x) => parseInt(x, 16)) ?? []);
const F = Math.fround;

function written(fn: (w: BinaryWriter) => void): string {
  const w = new BinaryWriter(64);
  fn(w);
  return hex(w.getData());
}

function expectNoDiffs(diffs: unknown[], total: number) {
  expect(diffs, `${diffs.length} of ${total} differ\n${diffs.slice(0, 6).map((d) => JSON.stringify(d)).join('\n')}`).toHaveLength(0);
}

describe('message encoding matches qcommon/common.c', () => {
  let bin: string;
  beforeAll(() => {
    bin = msgOracleBin();
  });

  it('coordinates and angles', () => {
    const rng = new RandomGenerator({ seed: SEED });
    const values: number[] = [];
    for (let i = 0; i < N; i++) {
      // Plain values, values on the 1/8 and angle grids (where truncation turns), and out of range.
      const r = rng.frandom();
      const v = r < 0.4 ? rng.crandom() * 4096 : r < 0.7 ? Math.round(rng.crandom() * 4096 * 8) / 8 : r < 0.9 ? rng.crandom() * 720 : rng.crandom() * 40000;
      values.push(F(v));
    }
    const ops = ['coord', 'angle', 'angle16'] as const;
    const lines = values.flatMap((v) => ops.map((op) => `${op} ${v}`));
    const answers = runOracleLines(bin, [], lines);
    const diffs: unknown[] = [];
    values.forEach((v, i) => {
      ops.forEach((op, k) => {
        const ts = written((w) => (op === 'coord' ? w.writeCoord(v) : op === 'angle' ? w.writeAngle(v) : w.writeAngle16(v)));
        const c = answers[i * 3 + k].hex;
        if (ts !== c) diffs.push({ op, v, ts, c });
      });
    });
    expectNoDiffs(diffs, lines.length);
  });

  it('directions', () => {
    const rng = new RandomGenerator({ seed: SEED + 1 });
    const dirs: [number, number, number][] = [[0, 0, 0]];
    for (let i = 0; i < N; i++) {
      const d: [number, number, number] = [rng.crandom(), rng.crandom(), rng.crandom()];
      const len = Math.hypot(...d);
      // Most are unit vectors (plane normals, impact directions); some are not.
      const s = i % 5 === 0 ? 1 : 1 / len;
      dirs.push([F(d[0] * s), F(d[1] * s), F(d[2] * s)]);
    }
    const lines = [...dirs.map((d) => `dir ${d.join(' ')}`), ...Array.from({ length: 162 }, (_, b) => `readdir ${b}`)];
    const answers = runOracleLines(bin, [], lines);
    const diffs: unknown[] = [];
    dirs.forEach((d, i) => {
      const ts = written((w) => w.writeDir({ x: d[0], y: d[1], z: d[2] }));
      if (ts !== answers[i].hex) diffs.push({ op: 'dir', d, ts, c: answers[i].hex });
    });
    for (let b = 0; b < 162; b++) {
      const out = { x: 0, y: 0, z: 0 };
      new BinaryStream(new Uint8Array([b])).readDir(out);
      const c = answers[dirs.length + b].dir;
      if (Math.abs(out.x - c[0]) > 1e-6 || Math.abs(out.y - c[1]) > 1e-6 || Math.abs(out.z - c[2]) > 1e-6) {
        diffs.push({ op: 'readdir', b, ts: out, c });
      }
    }
    expectNoDiffs(diffs, lines.length);
  });

  it('CRC_Block and COM_BlockSequenceCRCByte', () => {
    const rng = new RandomGenerator({ seed: SEED + 2 });
    const cases: { bytes: Uint8Array; seq: number }[] = [];
    for (let i = 0; i < N; i++) {
      const n = rng.irandom(i % 10 === 0 ? 200 : 64);
      const bytes = new Uint8Array(n);
      for (let k = 0; k < n; k++) bytes[k] = rng.irandom(256);
      // Sequences across the whole table, including where it wraps (1020) and its zero tail.
      const seq = i % 7 === 0 ? 1000 + rng.irandom(40) : rng.irandom(1 << 30);
      cases.push({ bytes, seq });
    }
    const lines = cases.flatMap(({ bytes, seq }) => [`crc ${bytes.length} ${hex(bytes)}`, `seqcrc ${seq} ${bytes.length} ${hex(bytes)}`]);
    const answers = runOracleLines(bin, [], lines);
    const diffs: unknown[] = [];
    cases.forEach(({ bytes, seq }, i) => {
      const block = crcBlock(bytes);
      const sequenced = blockSequenceCrcByte(bytes, seq);
      if (block !== answers[i * 2].crc) diffs.push({ op: 'crc', bytes: hex(bytes), ts: block, c: answers[i * 2].crc });
      if (sequenced !== answers[i * 2 + 1].crc) diffs.push({ op: 'seqcrc', seq, bytes: hex(bytes), ts: sequenced, c: answers[i * 2 + 1].crc });
    });
    expectNoDiffs(diffs, lines.length);
  });

  describe('entity deltas', () => {
    interface CEnt {
      number: number;
      origin: number[];
      angles: number[];
      oldOrigin: number[];
      modelindex: number[];
      frame: number;
      skinnum: number;
      effects: number;
      renderfx: number;
      solid: number;
      sound: number;
      event: number;
    }

    const rng = new RandomGenerator({ seed: SEED + 3 });
    const pick = <T,>(xs: readonly T[]) => xs[rng.irandom(xs.length)];
    const sized = (small: number, medium: number, large: number) => {
      const r = rng.frandom();
      return r < 0.6 ? rng.irandom(small) : r < 0.85 ? rng.irandom(medium) : rng.irandom(large);
    };
    const coord = () => F(rng.frandom() < 0.5 ? Math.round(rng.crandom() * 4096 * 8) / 8 : rng.crandom() * 4096);
    const randomState = (number: number): CEnt => ({
      number,
      origin: [coord(), coord(), coord()],
      angles: [F(rng.frandomRange(0, 360)), F(rng.frandomRange(0, 360)), F(rng.frandomRange(-30, 30))],
      oldOrigin: [coord(), coord(), coord()],
      modelindex: [rng.irandom(256), rng.irandom(4) ? 0 : rng.irandom(256), rng.irandom(4) ? 0 : rng.irandom(256), rng.irandom(4) ? 0 : rng.irandom(256)],
      frame: sized(256, 2000, 32768),
      // Laser colours (0xf2f2f0f0 and the like) are whole 32-bit skins.
      skinnum: rng.frandom() < 0.1 ? pick([0xf2f2f0f0 | 0, 0xd0d1d2d3 | 0, 0xe0e1e2e3 | 0]) : sized(256, 0x10000, 0x7fffffff),
      effects: sized(256, 0x8000, 0x7fffffff) + (rng.frandom() < 0.1 ? 0x80000000 : 0),
      renderfx: rng.frandom() < 0.1 ? 128 /* RF_BEAM */ : sized(256, 0x8000, 0x7fffffff),
      solid: sized(32, 0x8000, 0x8000),
      sound: rng.frandom() < 0.7 ? 0 : rng.irandom(256),
      event: rng.frandom() < 0.7 ? 0 : rng.irandom(256),
    });
    /** Some of `from` carried over, so the delta has unchanged fields to leave out. */
    const nextState = (from: CEnt): CEnt => {
      const to = randomState(from.number);
      const keep = <K extends keyof CEnt>(k: K) => {
        if (rng.frandom() < 0.6) (to as any)[k] = Array.isArray(from[k]) ? [...(from[k] as number[])] : from[k];
      };
      (['origin', 'angles', 'oldOrigin', 'modelindex', 'frame', 'skinnum', 'effects', 'renderfx', 'solid', 'sound', 'event'] as const).forEach(keep);
      if (rng.frandom() < 0.3) to.origin[rng.irandom(3)] = from.origin[rng.irandom(3)];
      return to;
    };
    const line = (e: CEnt) =>
      [e.number, ...e.origin, ...e.angles, ...e.oldOrigin, ...e.modelindex, e.frame, e.skinnum, e.effects | 0, e.renderfx, e.solid, e.sound, e.event].join(' ');
    const toTs = (e: CEnt): EntityState => ({
      number: e.number,
      origin: { x: e.origin[0], y: e.origin[1], z: e.origin[2] },
      angles: { x: e.angles[0], y: e.angles[1], z: e.angles[2] },
      oldOrigin: { x: e.oldOrigin[0], y: e.oldOrigin[1], z: e.oldOrigin[2] },
      modelIndex: e.modelindex[0],
      modelIndex2: e.modelindex[1],
      modelIndex3: e.modelindex[2],
      modelIndex4: e.modelindex[3],
      frame: e.frame,
      skinNum: e.skinnum,
      effects: e.effects,
      renderfx: e.renderfx,
      solid: e.solid,
      sound: e.sound,
      event: e.event,
    });

    const cases: { from: CEnt; to: CEnt; force: boolean; newEntity: boolean }[] = [];
    let answers: any[] = [];
    let parsed: any[] = [];

    beforeAll(() => {
      for (let i = 0; i < N; i++) {
        const number = 1 + (rng.frandom() < 0.7 ? rng.irandom(255) : rng.irandom(1023));
        const from = rng.frandom() < 0.2 ? { ...randomState(number), origin: [0, 0, 0], angles: [0, 0, 0], modelindex: [0, 0, 0, 0], frame: 0, skinnum: 0, effects: 0, renderfx: 0, solid: 0, sound: 0, event: 0 } : randomState(number);
        // A tenth are unchanged, which must write nothing unless forced.
        const to = i % 10 === 0 ? { ...from, event: 0 } : nextState(from);
        cases.push({ from, to, force: rng.frandom() < 0.2, newEntity: rng.frandom() < 0.2 });
      }
      answers = runOracleLines(
        msgOracleBin(),
        [],
        cases.map((c) => `ent ${line(c.from)} ${line(c.to)} ${+c.force} ${+c.newEntity}`),
      );
      const nonEmpty = answers.map((a) => a.hex as string).filter((h) => h.length > 0);
      parsed = runOracleLines(msgOracleBin(), [], nonEmpty.map((h) => `parse ${h.length / 2} ${h}`));
    });

    it('writeDeltaEntity writes the bytes MSG_WriteDeltaEntity does', () => {
      const diffs: unknown[] = [];
      cases.forEach((c, i) => {
        const ts = written((w) => writeDeltaEntity(toTs(c.from), toTs(c.to), w, c.force, c.newEntity));
        if (ts !== answers[i].hex) diffs.push({ from: c.from, to: c.to, force: c.force, newEntity: c.newEntity, ts, c: answers[i].hex });
      });
      expect(answers.filter((a) => a.hex === '').length).toBeGreaterThan(0); // unchanged and not forced
      expectNoDiffs(diffs, cases.length);
    });

    it('the demo writer writes them as MSG_WriteDeltaEntity does', () => {
      const toDemo = (e: CEnt) => {
        const d = createEmptyEntityState();
        d.number = e.number;
        d.origin = { x: e.origin[0], y: e.origin[1], z: e.origin[2] };
        d.angles = { x: e.angles[0], y: e.angles[1], z: e.angles[2] };
        d.old_origin = { x: e.oldOrigin[0], y: e.oldOrigin[1], z: e.oldOrigin[2] };
        [d.modelindex, d.modelindex2, d.modelindex3, d.modelindex4] = e.modelindex;
        Object.assign(d, { frame: e.frame, skinnum: e.skinnum, effects: e.effects, renderfx: e.renderfx, solid: e.solid, sound: e.sound, event: e.event });
        return d;
      };
      const diffs: unknown[] = [];
      let checked = 0;
      cases.forEach((c, i) => {
        if (c.force !== c.newEntity) return; // the demo writer's force is both
        checked++;
        const w = new BinaryWriter(64);
        new MessageWriter(w, 34).writeDeltaEntity(toDemo(c.from), toDemo(c.to), c.force);
        const ts = hex(w.getData());
        if (ts !== answers[i].hex) diffs.push({ from: c.from, to: c.to, force: c.force, ts, c: answers[i].hex });
      });
      expectNoDiffs(diffs, checked);
    });

    it('the demo parser reads them as CL_ParseDelta does', () => {
      const handler = new Quake2ProtocolHandler();
      const nonEmpty = answers.map((a) => a.hex as string).filter((h) => h.length > 0);
      const diffs: unknown[] = [];
      const same = (a: number, b: number) => Math.abs(a - b) < 1e-4;
      // Angles are bytes: the C reads them signed (-180..180), the parser unsigned (0..360).
      const sameAngle = (a: number, b: number) => same(((a - b) % 360 + 540) % 360 - 180, 0);
      nonEmpty.forEach((h, i) => {
        const stream = new StreamingBuffer(64);
        stream.append(fromHex(h));
        const { number, bits, bitsHigh } = handler.parseEntityBits(stream as any);
        const e = createEmptyEntityState();
        handler.parseDelta(createEmptyEntityState(), e, number, bits, bitsHigh, stream as any);
        const c = parsed[i] as CEnt & { read: number };
        const why: string[] = [];
        if (e.number !== c.number) why.push('number');
        if (![0, 1, 2].every((k) => same([e.origin.x, e.origin.y, e.origin.z][k], c.origin[k]))) why.push('origin');
        if (![0, 1, 2].every((k) => sameAngle([e.angles.x, e.angles.y, e.angles.z][k], c.angles[k]))) why.push('angles');
        if (![0, 1, 2].every((k) => same([e.old_origin.x, e.old_origin.y, e.old_origin.z][k], c.oldOrigin[k]))) why.push('oldOrigin');
        if ([e.modelindex, e.modelindex2, e.modelindex3, e.modelindex4].join() !== c.modelindex.join()) why.push('modelindex');
        if (e.frame !== c.frame) why.push('frame');
        if (e.skinnum !== c.skinnum) why.push('skinnum');
        if (e.effects >>> 0 !== c.effects) why.push('effects');
        if (e.renderfx !== c.renderfx) why.push('renderfx');
        if (e.solid !== c.solid) why.push('solid');
        if (e.sound !== c.sound) why.push('sound');
        if (e.event !== c.event) why.push('event');
        if (why.length) diffs.push({ why, hex: h, c, ts: e });
      });
      expectNoDiffs(diffs, nonEmpty.length);
    });
  });
});
