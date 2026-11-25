/**
 * Runs the C reference oracle (see ../harness.c) as a child process and
 * answers collision queries synchronously over a line protocol.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PakArchive } from '@quake2ts/engine';
import type { Vec3 } from '@quake2ts/shared';

export const ORACLE_DIR = resolve(__dirname, '..');
export const BUILD_DIR = join(ORACLE_DIR, 'build');
export const PAK_PATH = resolve(ORACLE_DIR, '../pak.pak');

export interface OracleTrace {
  fraction: number;
  endpos: [number, number, number];
  normal: [number, number, number];
  dist: number;
  contents: number;
  surfaceFlags: number;
  startsolid: boolean;
  allsolid: boolean;
}

export type OracleQuery =
  | { op: 'trace'; start: Vec3; end: Vec3; mins: Vec3; maxs: Vec3; mask: number; headnode: number }
  | { op: 'contents'; point: Vec3; headnode: number }
  | { op: 'ttrace'; start: Vec3; end: Vec3; mins: Vec3; maxs: Vec3; mask: number; headnode: number; origin: Vec3; angles: Vec3 }
  | { op: 'btrace'; start: Vec3; end: Vec3; mins: Vec3; maxs: Vec3; mask: number; boxMins: Vec3; boxMaxs: Vec3; origin: Vec3 }
  | { op: 'tcontents'; point: Vec3; headnode: number; origin: Vec3; angles: Vec3 };

/** Builds the oracle binary if needed and returns its path. Throws if no C compiler is available. */
export function buildOracle(): string {
  if (process.env.Q2ORACLE_BIN) return process.env.Q2ORACLE_BIN;
  const bin = join(BUILD_DIR, 'q2oracle');
  execFileSync('sh', [join(ORACLE_DIR, 'build.sh')], { stdio: 'pipe' });
  if (!existsSync(bin)) throw new Error('q2oracle did not build');
  return bin;
}

/** Extracts a map from the repo's demo pak to a file the oracle can read. */
export function extractMap(mapPath: string): { file: string; data: ArrayBuffer } {
  const buf = readFileSync(PAK_PATH);
  const pak = PakArchive.fromArrayBuffer('pak.pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const bytes = pak.readFile(mapPath);
  mkdirSync(BUILD_DIR, { recursive: true });
  const file = join(BUILD_DIR, mapPath.replace(/[\\/]/g, '_'));
  writeFileSync(file, bytes);
  return { file, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}

const f = (v: Vec3) => `${v.x} ${v.y} ${v.z}`;

function encode(q: OracleQuery): string {
  if (q.op === 'trace') {
    return `trace ${f(q.start)} ${f(q.end)} ${f(q.mins)} ${f(q.maxs)} ${q.mask | 0} ${q.headnode}`;
  }
  if (q.op === 'ttrace') {
    return `ttrace ${f(q.start)} ${f(q.end)} ${f(q.mins)} ${f(q.maxs)} ${q.mask | 0} ${q.headnode} ${f(q.origin)} ${f(q.angles)}`;
  }
  if (q.op === 'btrace') {
    return `btrace ${f(q.start)} ${f(q.end)} ${f(q.mins)} ${f(q.maxs)} ${q.mask | 0} ${f(q.boxMins)} ${f(q.boxMaxs)} ${f(q.origin)}`;
  }
  if (q.op === 'tcontents') {
    return `tcontents ${f(q.point)} ${q.headnode} ${f(q.origin)} ${f(q.angles)}`;
  }
  return `contents ${f(q.point)} ${q.headnode}`;
}

/** Runs a batch of queries through the oracle in one process and returns one parsed answer per query. */
export function runOracle(bin: string, bspFile: string, queries: readonly OracleQuery[]): any[] {
  const input = queries.map(encode).join('\n') + '\n';
  const res = spawnSync(bin, [bspFile], { input, maxBuffer: 256 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`q2oracle failed: ${res.stderr.toString()}`);
  const lines = res.stdout.toString().trim().split('\n');
  const ready = JSON.parse(lines[0]);
  if (!ready.ready) throw new Error(`q2oracle did not load the map: ${lines[0]}`);
  const answers = lines.slice(1).map((l) => JSON.parse(l));
  if (answers.length !== queries.length) {
    throw new Error(`q2oracle answered ${answers.length} of ${queries.length} queries`);
  }
  return answers;
}

/** Path of the player-movement oracle (rerelease p_move.cpp), built alongside q2oracle. */
export function pmoveOracleBin(): string {
  if (process.env.Q2PMOVE_BIN) return process.env.Q2PMOVE_BIN;
  buildOracle();
  const bin = join(BUILD_DIR, 'q2pmove');
  if (!existsSync(bin)) throw new Error('q2pmove did not build (needs a C++20 compiler)');
  return bin;
}

/** Sends raw command lines to an oracle binary and returns one parsed JSON answer per line. */
export function runOracleLines(bin: string, args: string[], lines: readonly string[]): any[] {
  const res = spawnSync(bin, args, { input: lines.join('\n') + '\n', maxBuffer: 512 * 1024 * 1024 });
  if (res.status !== 0) throw new Error(`${bin} failed: ${res.stderr.toString()}`);
  const out = res.stdout.toString().trim().split('\n');
  const ready = JSON.parse(out[0]);
  if (!ready.ready) throw new Error(`${bin} did not start: ${out[0]}`);
  const answers = out.slice(1).map((l) => JSON.parse(l));
  if (answers.length !== lines.length) throw new Error(`${bin} answered ${answers.length} of ${lines.length} lines`);
  return answers;
}

/** Path of the message-encoding oracle (common.c and crc.c), built alongside q2oracle. */
export function msgOracleBin(): string {
  if (process.env.Q2MSG_BIN) return process.env.Q2MSG_BIN;
  buildOracle();
  return join(BUILD_DIR, 'q2msg');
}

/** Path of the model-loader oracle (ref_gl's gl_model.c), built alongside q2oracle. */
export function modelOracleBin(): string {
  if (process.env.Q2MODEL_BIN) return process.env.Q2MODEL_BIN;
  buildOracle();
  return join(BUILD_DIR, 'q2model');
}
