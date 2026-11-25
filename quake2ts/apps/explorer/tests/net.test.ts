// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { parseBsp } from '@quake2ts/formats';
import { Library } from '../src/library/library';
import { worldFromMap, type LabWorld } from '../src/labs/world';
import { DEFAULT_NET, simulateNet } from '../src/labs/net/simulate';
import { demoPak } from './setup';

let world: LabWorld;
beforeAll(async () => {
  const library = new Library();
  library.mount('pak.pak', demoPak.buffer.slice(demoPak.byteOffset, demoPak.byteOffset + demoPak.byteLength) as ArrayBuffer);
  world = worldFromMap(parseBsp(await library.read('maps/demo1.bsp')));
});

const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const firstMove = (frames: readonly { t: number; predicted: { x: number; y: number } }[]) => frames.find((f) => d(f.predicted, world.start.origin) > 1)!.t;

// The lag lab's run: a client and a server on the port's NetChan and runPmove, arranged as id's are.
describe('lag lab run', () => {
  it('shows a key at once with prediction, and after a round trip and a server frame without', () => {
    const on = simulateNet(world, DEFAULT_NET, true);
    const off = simulateNet(world, DEFAULT_NET, false);
    expect(firstMove(on.frames)).toBeLessThanOrEqual(2 * DEFAULT_NET.clientMsec);
    // A 100 ms round trip, a wait for the next 100 ms snapshot, then the blend between snapshots.
    expect(firstMove(off.frames)).toBeGreaterThanOrEqual(2 * DEFAULT_NET.latency + DEFAULT_NET.serverMsec);
    expect(on.worstMiss).toBe(0);
  });

  it('acknowledges commands through the NetChan header, so prediction replays only the newest', () => {
    const run = simulateNet(world, DEFAULT_NET, true);
    const server = run.packets.filter((p) => p.from === 'server');
    expect(server.every((p, i) => i === 0 || p.ack >= server[i - 1]!.ack)).toBe(true);
    // About a round trip and a server frame of commands are in flight at once: 200 ms at 25 ms each.
    expect(Math.max(...run.frames.map((f) => f.unacknowledged))).toBeLessThanOrEqual(9);
  });

  it('rides out lost packets with the two older commands each packet carries', () => {
    const run = simulateNet(world, { ...DEFAULT_NET, loss: 0.2 }, true);
    expect(run.packets.filter((p) => p.arrivesAt === null).length).toBeGreaterThan(10);
    expect(run.neverRun).toBe(0);
    expect(run.worstMiss).toBe(0);
  });

  it('repeats the last command for longer losses, which costs nothing while the keys stay the same', () => {
    const run = simulateNet(world, { ...DEFAULT_NET, loss: 0.5, seed: 3 }, true);
    expect(run.repeated).toBeGreaterThan(0);
    expect(run.neverRun).toBe(run.repeated);
  });

  it('corrects a push only the server knew of', () => {
    const run = simulateNet(world, { ...DEFAULT_NET, pushAt: 1000 }, true);
    expect(run.worstMiss).toBeGreaterThan(10);
    expect(Math.max(...run.frames.map((f) => f.correction))).toBeGreaterThan(5);
  });

  it('throws late packets away, as NetChan.process does', () => {
    const run = simulateNet(world, { ...DEFAULT_NET, jitter: 80 }, true);
    expect(run.packets.some((p) => p.discarded)).toBe(true);
  });

  it('freezes prediction rather than replay a partial history when CMD_BACKUP overflows', () => {
    const run = simulateNet(world, { ...DEFAULT_NET, latency: 300, clientMsec: 10, serverMsec: 200 }, true);
    expect(run.frozen).toBeGreaterThan(0);
    // Lossless and deterministic, so no snapshot may disagree with a prediction.
    expect(run.worstMiss).toBe(0);
  });

  it('marks snapshots thrown away for arriving late', () => {
    const run = simulateNet(world, { ...DEFAULT_NET, jitter: 150, serverMsec: 25 }, true);
    expect(run.packets.some((p) => p.from === 'server' && p.discarded)).toBe(true);
  });

  it('is the same run for the same seed', () => {
    const setup = { ...DEFAULT_NET, loss: 0.2, jitter: 40 };
    expect(simulateNet(world, setup, true)).toEqual(simulateNet(world, setup, true));
  });
});
