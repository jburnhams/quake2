// The lag lab's simulation: one player on demo1, a client and a server, and a network between them
// with latency, jitter and loss. Pure and DOM-free, deterministic for a seed, so the node tests run
// it and the screen reruns it on every slider change.
//
// What runs is the game's own code where the port has it, arranged as id's engine arranges it:
// - Both ends run the port's NetChan (shared/net/netchan.ts) for sequence and ack numbers.
// - Both ends move the player with the port's runPmove through demo1's collision.
// - The client sends each command with the two before it, as CL_SendCmd does, and keeps it
//   (cl.cmds) until a snapshot acknowledges it.
// - The server runs commands as they arrive, as SV_ExecuteClientMessage does: the one or two older
//   commands in the packet when the ones before were lost, the last good command again for each
//   further loss, then the new one.
// - Every server frame it sends a snapshot of the player.
// - The client predicts as CL_PredictMovement does: from the last snapshot, it replays every
//   command the server has not acknowledged. CL_CheckPredictionError compares the snapshot with
//   what was predicted for the acknowledged command and slides the difference out over one server
//   frame (CL_CalcViewValues).
// - Without prediction, the client draws the player between the last two snapshots.
//
// Simplifications, each named where it is made:
// - Commands carry their index, not delta-compressed bytes.
// - A snapshot carries its index into the server's list, not the player state.
// - The client's clock does not drift.
import { NetChan } from '@quake2ts/shared/net/netchan';
import { PmFlag, runPmove, type PmoveCmd, type PmoveState } from '@quake2ts/shared/pmove';
import type { Vec } from '../orbit';
import type { LabWorld } from '../world';
import { DEFAULT_LAB_TUNING, pmoveImports, scriptedCmd, startState, type LabTuning } from '../movement/simulate';

export interface NetSetup {
  /** One-way delay, in ms. */
  readonly latency: number;
  /** Up to this much more, at random, per packet, in ms. */
  readonly jitter: number;
  /** The share of packets lost each way, 0 to 1. */
  readonly loss: number;
  /** How long a server frame lasts, in ms: 100 in the 1997 release (10 Hz), 25 in the rerelease. */
  readonly serverMsec: number;
  /** How long a client frame lasts, in ms: one command and one packet each. */
  readonly clientMsec: number;
  /** When the server pushes the player (a rocket's knockback the client cannot know of), in ms, or null. */
  readonly pushAt: number | null;
  readonly seed: number;
}

export const DEFAULT_NET: NetSetup = { latency: 50, jitter: 0, loss: 0, serverMsec: 100, clientMsec: 25, pushAt: null, seed: 1 };

/** The run lasts this long, in ms. */
export const NET_RUN_MS = 2500;
/** CMD_BACKUP: how many commands the client keeps for prediction. */
const CMD_BACKUP = 64;
/** CL_CheckPredictionError treats a miss of more than 80 units (640 in its eighths) as a teleport. */
const TELEPORT_MISS = 80;
/** The push: a rocket's knockback, sideways and up, in units per second. */
const PUSH = { side: 300, up: 250 };

export interface Packet {
  readonly from: 'client' | 'server';
  /** The NetChan sequence it was sent with, and the sequence it acknowledges. */
  readonly sequence: number;
  readonly ack: number;
  readonly sentAt: number;
  /** When it arrives, or null when it is lost. */
  readonly arrivesAt: number | null;
  /** The receiver threw it away: it came after a later one (NetChan.process). */
  discarded?: boolean;
  /** A client packet: the commands it carries, oldest first. */
  readonly cmds?: readonly number[];
  /** A server packet: the server frame it is a snapshot of. */
  readonly frame?: number;
}

export interface NetFrame {
  /** Client time, in ms. */
  readonly t: number;
  /** Where the server has the player at this moment. */
  readonly server: Vec;
  /** Where the client draws the player with prediction, and without. */
  readonly predicted: Vec;
  readonly interpolated: Vec;
  /** The prediction error still being slid out, in units. */
  readonly correction: number;
  /** Commands sent but not yet acknowledged, which prediction replays. */
  readonly unacknowledged: number;
}

export interface NetRun {
  readonly frames: readonly NetFrame[];
  readonly packets: readonly Packet[];
  /** Commands the server ran in place of lost ones (repeats of the last good command). */
  readonly repeated: number;
  /** Commands the server never ran. */
  readonly neverRun: number;
  /** The largest prediction miss the client had to correct, in units. */
  readonly worstMiss: number;
  /** Client frames where more than CMD_BACKUP commands were unacknowledged, so prediction froze. */
  readonly frozen: number;
}

/** A small seeded generator (mulberry32), so a setup always gives the same losses. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: Vec, b: Vec, f: number): Vec => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const len = (v: Vec) => Math.hypot(v.x, v.y, v.z);

function u32s(values: readonly number[]): Uint8Array {
  const out = new Uint8Array(values.length * 4);
  const view = new DataView(out.buffer);
  values.forEach((v, i) => view.setInt32(i * 4, v, true));
  return out;
}
function readU32s(bytes: Uint8Array): number[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return Array.from({ length: bytes.byteLength / 4 }, (_, i) => view.getInt32(i * 4, true));
}

type Event = { at: number; order: number; run: () => void };

export function simulateNet(world: LabWorld, setup: NetSetup, predict: boolean, tuning: LabTuning = DEFAULT_LAB_TUNING): NetRun {
  const imports = pmoveImports(world);
  const rand = { up: random(setup.seed), down: random(setup.seed * 7919 + 1) };
  const move = (state: PmoveState, cmd: PmoveCmd) => runPmove({ ...state, cmd, gravity: tuning.gravity }, imports, tuning);

  // One NetChan each end, on the same qport so each accepts the other's packets.
  const clientChan = new NetChan();
  const serverChan = new NetChan();
  clientChan.setup(27901);
  serverChan.setup(27901);

  const events: Event[] = [];
  let order = 0;
  const at = (time: number, run: () => void) => events.push({ at: time, order: order++, run });
  const packets: Packet[] = [];

  /** Puts a packet on the wire: it arrives after the delay, unless it is lost. */
  const send = (from: 'client' | 'server', bytes: Uint8Array, now: number, extra: Partial<Packet>, deliver: (bytes: Uint8Array, p: Packet) => void) => {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const r = from === 'client' ? rand.up : rand.down;
    const lost = r() < setup.loss;
    const delay = setup.latency + r() * setup.jitter;
    const packet: Packet = {
      from,
      sequence: view.getUint32(0, true) & 0x3fffffff,
      ack: view.getUint32(4, true) & 0x7fffffff,
      sentAt: now,
      arrivesAt: lost ? null : now + delay,
      ...extra,
    };
    packets.push(packet);
    if (!lost) at(now + delay, () => deliver(bytes, packet));
  };

  // The client's commands (cl.cmds), indexed by the NetChan sequence of the packet that first carried them.
  const cmds = new Map<number, PmoveCmd>();
  // The server: the player's state, the last command it ran, its snapshots.
  const firstCmd = scriptedCmd(world, 0, setup.clientMsec);
  let serverState = startState(world, tuning, firstCmd);
  let serverLast: PmoveCmd | null = null;
  let serverLastIndex = 0;
  let repeated = 0;
  let neverRun = 0;
  let pushed = false;
  const snapshots: { state: PmoveState; time: number }[] = [];
  const serverTrack: { time: number; origin: Vec }[] = [{ time: 0, origin: serverState.origin }];

  // The client: the last two snapshots it has, when the last arrived, and the miss being slid out.
  let base: { state: PmoveState; arrived: number; previous: Vec; ack: number } = { state: serverState, arrived: 0, previous: serverState.origin, ack: 0 };
  const predictedAt = new Map<number, Vec>();
  let miss: Vec = { x: 0, y: 0, z: 0 };
  let worstMiss = 0;

  const serverRun = (cmd: PmoveCmd, time: number) => {
    if (setup.pushAt !== null && !pushed && time >= setup.pushAt) {
      // The push the client cannot predict: a rocket's knockback to the player's left and up.
      const yaw = (world.start.yaw * Math.PI) / 180;
      const v = serverState.velocity;
      serverState = { ...serverState, velocity: { x: v.x - Math.sin(yaw) * PUSH.side, y: v.y + Math.cos(yaw) * PUSH.side, z: v.z + PUSH.up }, pmFlags: serverState.pmFlags & ~PmFlag.OnGround };
      pushed = true;
    }
    serverState = move(serverState, cmd);
    serverLast = cmd;
    serverTrack.push({ time, origin: serverState.origin });
  };

  // Client frames: make a command, send it with the two before it (CL_SendCmd).
  const clientFrames = Math.floor(NET_RUN_MS / setup.clientMsec);
  for (let i = 0; i < clientFrames; i++) {
    const now = i * setup.clientMsec;
    at(now, () => {
      const sequence = clientChan.outgoingSequence + 1;
      cmds.set(sequence, scriptedCmd(world, i, setup.clientMsec));
      cmds.delete(sequence - CMD_BACKUP);
      const carried = [sequence - 2, sequence - 1, sequence].filter((s) => cmds.has(s));
      const bytes = clientChan.transmit(u32s(carried));
      send('client', bytes, now, { cmds: carried }, (b, p) => {
        const payload = serverChan.process(b);
        if (!payload) return void (p.discarded = true);
        const [newest] = readU32s(payload).slice(-1);
        // SV_ExecuteClientMessage: how many commands were dropped since the last one run.
        let drop = newest! - serverLastIndex - 1;
        const time = p.arrivesAt!;
        if (drop < 20) {
          while (drop > 2 && serverLast) {
            serverRun(serverLast, time);
            repeated++;
            neverRun++;
            drop--;
          }
          if (drop > 1) serverRun(cmds.get(newest! - 2)!, time);
          if (drop > 0) serverRun(cmds.get(newest! - 1)!, time);
        } else neverRun += drop;
        serverRun(cmds.get(newest!)!, time);
        serverLastIndex = newest!;
      });
    });
  }

  // Server frames: a snapshot of the player to the client.
  for (let f = 1; f * setup.serverMsec <= NET_RUN_MS; f++) {
    const now = f * setup.serverMsec;
    at(now, () => {
      snapshots.push({ state: serverState, time: now });
      const bytes = serverChan.transmit(u32s([snapshots.length - 1]));
      send('server', bytes, now, { frame: snapshots.length - 1 }, (b, p) => {
        const payload = clientChan.process(b);
        if (!payload) return void (p.discarded = true);
        const snap = snapshots[readU32s(payload)[0]!]!;
        const ack = clientChan.incomingAcknowledged;
        // CL_CheckPredictionError: the snapshot against what was predicted for that command.
        const guess = predictedAt.get(ack);
        if (guess) {
          const d = sub(snap.state.origin, guess);
          if (len(d) > TELEPORT_MISS) miss = { x: 0, y: 0, z: 0 };
          else {
            miss = d;
            worstMiss = Math.max(worstMiss, len(d));
          }
        }
        base = { state: snap.state, arrived: p.arrivesAt!, previous: base.state.origin, ack };
      });
    });
  }

  // Run the events in time order; at each client frame, after its command is sent, draw.
  events.sort((a, b) => a.at - b.at || a.order - b.order);
  const frames: NetFrame[] = [];
  let next = 0;
  let lastPredicted: Vec | null = null;
  let frozen = 0;
  for (let i = 0; i < clientFrames; i++) {
    const now = i * setup.clientMsec;
    while (next < events.length && events[next]!.at <= now) {
      // Events added while running (deliveries) are kept in order by re-sorting the rest.
      const e = events[next++]!;
      const before = events.length;
      e.run();
      if (events.length > before) {
        const rest = events.splice(next).sort((a, b) => a.at - b.at || a.order - b.order);
        events.push(...rest);
      }
    }
    // CL_PredictMovement: from the snapshot, replay every command it has not acknowledged.
    // When more commands are unacknowledged than it keeps (CMD_BACKUP), id's client freezes rather
    // than replay a partial history: the view stays where the last prediction left it.
    const current = clientChan.outgoingSequence;
    const overflowed = current - base.ack >= CMD_BACKUP;
    let state = base.state;
    if (overflowed) {
      state = { ...state, origin: lastPredicted ?? state.origin };
      frozen++;
    } else {
      for (let s = base.ack + 1; s <= current; s++) {
        state = move(state, cmds.get(s)!);
        predictedAt.set(s, state.origin);
      }
      lastPredicted = state.origin;
    }
    // How far into the server frame the client is (cl.lerpfrac), for the slide and the interpolation.
    const lerpfrac = Math.min(1, Math.max(0, (now - base.arrived) / setup.serverMsec));
    const backlerp = 1 - lerpfrac;
    const shown = { x: state.origin.x - miss.x * backlerp, y: state.origin.y - miss.y * backlerp, z: state.origin.z - miss.z * backlerp };
    frames.push({
      t: now,
      server: serverAt(serverTrack, now),
      predicted: predict ? shown : lerp(base.previous, base.state.origin, lerpfrac),
      interpolated: lerp(base.previous, base.state.origin, lerpfrac),
      correction: len(miss) * backlerp,
      unacknowledged: current - base.ack,
    });
  }
  // Remaining events (packets still in flight at the end) are left unrun.
  return { frames, packets, repeated, neverRun, worstMiss, frozen };
}

/** Where the server had the player at `time`: after the last command it had run by then. */
function serverAt(track: readonly { time: number; origin: Vec }[], time: number): Vec {
  let found = track[0]!.origin;
  for (const p of track) {
    if (p.time > time) break;
    found = p.origin;
  }
  return found;
}
