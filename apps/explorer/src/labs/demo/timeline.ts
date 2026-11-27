// A recorded demo (.dm2) read whole into a timeline, so the player can seek anywhere at once: each
// server frame rebuilt as a client rebuilds it (ClientFrames: a delta from the frame it names, over
// the baselines), with the configstrings that say what its model numbers are. What is drawn
// between two frames is lerped as CL_AddPacketEntities and CL_CalcViewValues do (cl_ents.c): the
// origin and angles from the old frame to the new, the MD2 frame blended, no lerp across a
// teleport, a model change or a jump of more than 512 units (CL_ParseDelta's test).
//
// The demo pak's demos/q2demo1.dm2 is Quake 2 3.14 (protocol 31). Its configstrings use the
// original q_shared.h layout (CS_MODELS 32, CS_LIGHTS 800, CS_PLAYERSKINS 1312), not the
// rerelease's, so they are named here rather than taken from @quake2ts/shared's ConfigStringIndex.
import {
  ClientFrames,
  DemoReader,
  NetworkMessageParser,
  type EntityState,
  type FrameData,
  type NetworkMessageHandler,
  type ProtocolPlayerState,
  type SceneEntitySource,
} from '@quake2ts/engine';
import type { Vec } from '../orbit';

/** Seconds between server frames: the original's 10 Hz. */
export const FRAME_SECONDS = 0.1;

/** q_shared.h's configstring layout for protocols 26 to 34. */
const CS = { name: 0, models: 32, lights: 800, playerSkins: 1312 } as const;
const MAX_LIGHTSTYLES = 256;
/** A modelindex of 255 is the client's own model (CL_AddPacketEntities), from CS_PLAYERSKINS. */
const CUSTOM_MODEL = 255;
/** EV_PLAYER_TELEPORT and EV_OTHER_TELEPORT: the entity is drawn where it landed, not lerped there. */
const TELEPORT_EVENTS = new Set([6, 7]);
const STAT_HEALTH = 1;
const STAT_AMMO = 3;
const STAT_ARMOR = 5;

/** One server frame, whole. */
export interface DemoFrame {
  /** Seconds from the first frame. */
  readonly time: number;
  readonly serverFrame: number;
  readonly entities: ReadonlyMap<number, EntityState>;
  readonly player: ProtocolPlayerState;
}

export interface DemoTimeline {
  readonly protocol: number;
  /** The level's name from svc_serverdata ("Installation"). */
  readonly levelName: string;
  /** The BSP the demo was recorded on ("maps/demo2.bsp"). */
  readonly mapName: string;
  /** The entity the recording player is (playernum + 1). */
  readonly viewer: number;
  readonly frames: readonly DemoFrame[];
  /** Seconds from the first frame to the last. */
  readonly duration: number;
  /** The MD2s the demo's entities and view weapon use, to load before drawing. */
  readonly models: readonly string[];
  /** Light style patterns (CS_LIGHTS), as [style, pattern]. */
  readonly lightStyles: ReadonlyArray<readonly [number, string]>;
  /** What a modelindex names: "*3" for a door, "models/monsters/soldier/tris.md2". */
  modelName(index: number): string | undefined;
}

/**
 * Reads every block of a demo. Throws the parser's own reason for a demo it cannot read (a 3.00
 * recording, protocol 25, is refused with UnsupportedProtocolError), and says so when there is
 * nothing to play.
 */
export function readDemo(buffer: ArrayBuffer): DemoTimeline {
  let protocol = 0;
  let levelName = '';
  let playerNum = 0;
  const strings = new Map<number, string>();
  const baselines = new Map<number, EntityState>();
  const read: FrameData[] = [];
  const ignore = () => {};
  const handler = new Proxy({} as NetworkMessageHandler, {
    get: (_t, name) => {
      switch (name) {
        case 'onServerData':
          return (p: number, _count: number, _attract: number, _dir: string, player: number, level: string) => {
            protocol = p;
            playerNum = player;
            levelName = level;
          };
        case 'onConfigString':
          return (index: number, value: string) => strings.set(index, value);
        case 'onSpawnBaseline':
          return (entity: EntityState) => baselines.set(entity.number, entity);
        case 'onFrame':
          return (frame: FrameData) => read.push(frame);
        default:
          return ignore;
      }
    },
  });
  const reader = new DemoReader(buffer);
  for (let block = reader.readNextBlock(); block; block = reader.readNextBlock()) {
    const parser = new NetworkMessageParser(block.data, handler);
    parser.setProtocolVersion(protocol);
    parser.parseMessage(); // throws UnsupportedProtocolError on svc_serverdata for a format it does not read
  }
  if (read.length === 0) throw new Error('The demo has no frames to play.');

  const history = new ClientFrames();
  const first = read[0]!.serverFrame;
  const frames: DemoFrame[] = [];
  for (const data of read) {
    const frame = history.parse(data, baselines);
    if (!frame.valid) continue; // its delta frame was gone; a client waits for the next whole one too
    frames.push({ time: (data.serverFrame - first) * FRAME_SECONDS, serverFrame: data.serverFrame, entities: frame.entities, player: frame.playerState });
  }
  if (frames.length === 0) throw new Error('None of the demo\'s frames could be rebuilt.');

  const skin = parsePlayerSkin(strings.get(CS.playerSkins + playerNum));
  const modelName = (index: number) => (index === CUSTOM_MODEL ? skin.model : strings.get(CS.models + index) || undefined);
  const models = new Set<string>();
  for (let i = 1; i < CUSTOM_MODEL; i++) {
    const name = strings.get(CS.models + i);
    if (name?.endsWith('.md2')) models.add(name);
  }
  models.add(skin.model);
  models.add(skin.weapon);
  const lightStyles: [number, string][] = [];
  for (let i = 0; i < MAX_LIGHTSTYLES; i++) {
    const pattern = strings.get(CS.lights + i);
    if (pattern !== undefined) lightStyles.push([i, pattern]);
  }
  return {
    protocol,
    levelName: levelName || strings.get(CS.name) || '',
    mapName: strings.get(CS.models + 1) ?? '',
    viewer: playerNum + 1,
    frames,
    duration: frames.at(-1)!.time,
    models: [...models],
    lightStyles,
    modelName: (index) => modelName(index),
  };
}

/** CS_PLAYERSKINS is "name\model/skin"; the model and its weapon are under players/ (CL_LoadClientinfo). */
function parsePlayerSkin(value: string | undefined): { model: string; weapon: string } {
  const [, path = 'male/grunt'] = (value ?? '').split('\\');
  const [model = 'male'] = path.split('/');
  return { model: `players/${model}/tris.md2`, weapon: `players/${model}/weapon.md2` };
}

/** What is seen at one moment of the demo. */
export interface DemoView {
  /** The index of the frame at or before the moment. */
  readonly frame: number;
  /** The player's eye (origin plus view offset) and where it looks (view angles plus kick). */
  readonly eye: Vec;
  readonly angles: Vec;
  /** The player's origin, which a camera following them circles. */
  readonly origin: Vec;
  /** Units a second, along the ground. */
  readonly speed: number;
  readonly health: number;
  readonly armor: number;
  readonly ammo: number;
  /** Every entity to draw but the player. */
  readonly entities: readonly SceneEntitySource[];
  /** The player's own models (their body and the weapon in their hand), which a first-person view leaves out. */
  readonly player: readonly SceneEntitySource[];
  /** The first-person weapon: its model, frame and blend, at the eye. */
  readonly weapon: { readonly model: string; readonly frame: number; readonly oldFrame: number; readonly frameLerp: number; readonly origin: Vec; readonly angles: Vec } | undefined;
}

/** The demo at `time` seconds, between the two frames either side of it. */
export function viewAt(demo: DemoTimeline, time: number): DemoView {
  const { frames } = demo;
  const i = frameIndexAt(frames, time);
  const prev = frames[i]!;
  const next = frames[Math.min(i + 1, frames.length - 1)]!;
  const span = next.time - prev.time;
  const lerp = span > 0 ? Math.min(1, Math.max(0, (time - prev.time) / span)) : 0;

  const entities: SceneEntitySource[] = [];
  const player: SceneEntitySource[] = [];
  for (const [number, now] of next.entities) {
    const was = prev.entities.get(number);
    const blend = was && !TELEPORT_EVENTS.has(now.event) && was.modelindex === now.modelindex && distance(was.origin, now.origin) <= 512;
    const origin = blend ? lerpVec(was.origin, now.origin, lerp) : now.origin;
    const angles = blend ? lerpAngles(was.angles, now.angles, lerp) : now.angles;
    const frame = { frame: now.frame, oldFrame: blend ? was.frame : now.frame, frameLerp: blend ? lerp : 1 };
    // modelindex2 to 4 are what an entity carries (a player's weapon), drawn at the same place.
    for (const modelindex of [now.modelindex, now.modelindex2, now.modelindex3, now.modelindex4]) {
      if (!modelindex) continue;
      const source: SceneEntitySource = { modelindex, origin, angles, effects: now.effects, skin: modelindex === CUSTOM_MODEL ? 0 : now.skinnum, ...frame };
      (number === demo.viewer ? player : entities).push(source);
    }
  }

  const ps = next.player;
  const ops = prev.player;
  const origin = lerpVec(ops.origin, ps.origin, lerp);
  const offset = lerpVec(ops.viewoffset, ps.viewoffset, lerp);
  const eye = { x: origin.x + offset.x, y: origin.y + offset.y, z: origin.z + offset.z };
  const view = lerpAngles(ops.viewangles, ps.viewangles, lerp);
  const kick = lerpVec(ops.kick_angles, ps.kick_angles, lerp);
  const angles = { x: view.x + kick.x, y: view.y + kick.y, z: view.z + kick.z };
  const gun = ps.gun_index ? demo.modelName(ps.gun_index) : undefined;
  const gunOffset = lerpVec(ops.gun_offset, ps.gun_offset, lerp);
  const gunAngles = lerpAngles(ops.gun_angles, ps.gun_angles, lerp);
  const weapon = gun
    ? {
        model: gun,
        frame: ps.gun_frame,
        oldFrame: ops.gun_index === ps.gun_index ? ops.gun_frame : ps.gun_frame,
        frameLerp: lerp,
        origin: { x: eye.x + gunOffset.x, y: eye.y + gunOffset.y, z: eye.z + gunOffset.z },
        angles: { x: angles.x + gunAngles.x, y: angles.y + gunAngles.y, z: angles.z + gunAngles.z },
      }
    : undefined;
  const velocity = ps.velocity;
  return {
    frame: lerp >= 1 ? Math.min(i + 1, frames.length - 1) : i,
    eye,
    angles,
    origin,
    speed: Math.hypot(velocity.x, velocity.y),
    health: ps.stats[STAT_HEALTH] ?? 0,
    armor: ps.stats[STAT_ARMOR] ?? 0,
    ammo: ps.stats[STAT_AMMO] ?? 0,
    entities,
    player,
    weapon,
  };
}

/** The last frame at or before `time` (the first before the start). */
export function frameIndexAt(frames: readonly DemoFrame[], time: number): number {
  let lo = 0;
  let hi = frames.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (frames[mid]!.time <= time) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

const lerpVec = (a: Vec, b: Vec, f: number): Vec => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f });
const distance = (a: Vec, b: Vec) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.z - b.z));

/** LerpAngle: the short way round. */
export function lerpAngle(a: number, b: number, f: number): number {
  let d = b - a;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return a + d * f;
}
const lerpAngles = (a: Vec, b: Vec, f: number): Vec => ({ x: lerpAngle(a.x, b.x, f), y: lerpAngle(a.y, b.y, f), z: lerpAngle(a.z, b.z, f) });
