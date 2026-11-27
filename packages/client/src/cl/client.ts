/**
 * The original Quake 2 client's view of the game, ported from id's 3.21 source (client/cl_main.c,
 * cl_parse.c, cl_ents.c, cl_pred.c, cl_view.c, cl_fx.c): it reads the server's messages (a live
 * server's or a demo's), keeps the frames and entities as `cl` and `cl_entities` keep them, and each
 * frame builds the refdef_t that the renderer draws: the view, the entity list with its lerps, the
 * dynamic lights, particles and light styles.
 *
 * Why a port rather than the rerelease-shaped client beside it: protocols 31 to 34 (the 3.x demos
 * and servers) number their configstrings and encode their entities as the original did, and the
 * demo lockstep oracle (`oracle/tests/demo.oracle.test.ts`) runs id's own client on the same
 * messages and compares this, field by field, every frame. Everything is in 32-bit floats as the C
 * is (see qmath.ts), so a match is exact.
 *
 * The network (netchan sequences) and platform (the clock) are inputs: `runFrame` takes what the
 * C's CL_Frame reads from them. The effects (cl_fx.c, cl_tent.c) are in fx.ts, drawing from the
 * same rand() as the C. Not yet ported: the Rogue mission pack's effects (cl_newfx.c), which throw,
 * and movement prediction for a player who can move (pmove.c); a frozen player (PM_FREEZE, as in
 * every frame of the demos) does not move, which is all prediction does then.
 */
import {
  NetworkMessageParser,
  createEmptyEntityState,
  createEmptyProtocolPlayerState,
  deltaPlayerState,
  type EntityState as ParsedEntity,
  type FrameData,
  type NetworkMessageHandler,
  type ProtocolPlayerState,
} from '@quake2ts/engine';
import { BinaryStream } from '@quake2ts/shared';
import * as d from './defs.js';
import { ClientEffects, type FxHost } from './fx.js';
import { anglemod, angleVectors, f, lerpAngle, Rand, short2angle, vectorMA, type Vec3 } from './qmath.js';

/** entity_state_t. */
export interface EntityState {
  number: number;
  origin: Vec3;
  angles: Vec3;
  old_origin: Vec3;
  modelindex: number;
  modelindex2: number;
  modelindex3: number;
  modelindex4: number;
  frame: number;
  skinnum: number;
  /** Unsigned: EF_TRACKERTRAIL is the top bit. */
  effects: number;
  renderfx: number;
  solid: number;
  sound: number;
  event: number;
}

const nullState = (): EntityState => ({
  number: 0, origin: [0, 0, 0], angles: [0, 0, 0], old_origin: [0, 0, 0],
  modelindex: 0, modelindex2: 0, modelindex3: 0, modelindex4: 0,
  frame: 0, skinnum: 0, effects: 0, renderfx: 0, solid: 0, sound: 0, event: 0,
});

const copyState = (s: EntityState): EntityState => ({
  ...s, origin: [...s.origin], angles: [...s.angles], old_origin: [...s.old_origin],
});

/** player_state_t, with pmove's shorts as the C keeps them (origin in eighths of a unit). */
export interface PlayerState {
  pmove: {
    pm_type: number;
    origin: Vec3;
    velocity: Vec3;
    pm_flags: number;
    pm_time: number;
    gravity: number;
    delta_angles: Vec3;
  };
  viewangles: Vec3;
  viewoffset: Vec3;
  kick_angles: Vec3;
  gunangles: Vec3;
  gunoffset: Vec3;
  gunindex: number;
  gunframe: number;
  blend: [number, number, number, number];
  fov: number;
  rdflags: number;
  stats: number[];
}

/** centity_t. */
interface CEntity {
  baseline: EntityState;
  current: EntityState;
  prev: EntityState;
  serverframe: number;
  trailcount: number;
  lerp_origin: Vec3;
  fly_stoptime: number;
}

const newCEntity = (): CEntity => ({
  baseline: nullState(), current: nullState(), prev: nullState(),
  serverframe: 0, trailcount: 0, lerp_origin: [0, 0, 0], fly_stoptime: 0,
});

/** frame_t. */
export interface Frame {
  valid: boolean;
  serverframe: number;
  servertime: number;
  deltaframe: number;
  areabits: Uint8Array;
  playerstate: PlayerState;
  /** The engine parser's form of the player state, which the next frame's deltas apply to. */
  parsedPlayerState: ProtocolPlayerState;
  num_entities: number;
  parse_entities: number;
}

/** entity_t, with the model and skin as the names ref_gl's model_t and image_t start with. */
export interface RefEntity {
  model: string | null;
  angles: Vec3;
  origin: Vec3;
  frame: number;
  oldorigin: Vec3;
  oldframe: number;
  backlerp: number;
  skinnum: number;
  lightstyle: number;
  alpha: number;
  skin: string | null;
  flags: number;
}

export interface DLight { origin: Vec3; color: Vec3; intensity: number }
export interface Particle { origin: Vec3; color: number; alpha: number }
export interface LightStyle { rgb: Vec3; white: number }

/** refdef_t: everything the renderer draws in a frame. */
export interface RefDef {
  x: number;
  y: number;
  width: number;
  height: number;
  fov_x: number;
  fov_y: number;
  vieworg: Vec3;
  viewangles: Vec3;
  blend: [number, number, number, number];
  time: number;
  rdflags: number;
  areabits: Uint8Array | null;
  lightstyles: LightStyle[];
  entities: RefEntity[];
  dlights: DLight[];
  particles: Particle[];
}

/** What ref_gl's Register* would find: a model or skin it can load, by name. */
export interface ClientAssets {
  hasModel(name: string): boolean;
  hasSkin(name: string): boolean;
  hasPic(name: string): boolean;
}

interface ClientInfo {
  name: string;
  cinfo: string;
  skin: string | null;
  icon: string | null;
  iconname: string;
  model: string | null;
  weaponmodel: (string | null)[];
}

const emptyClientInfo = (): ClientInfo => ({
  name: '', cinfo: '', skin: null, icon: null, iconname: '', model: null,
  weaponmodel: new Array(d.MAX_CLIENTWEAPONMODELS).fill(null),
});

const emptyPlayerState = (): PlayerState => ({
  pmove: { pm_type: 0, origin: [0, 0, 0], velocity: [0, 0, 0], pm_flags: 0, pm_time: 0, gravity: 0, delta_angles: [0, 0, 0] },
  viewangles: [0, 0, 0], viewoffset: [0, 0, 0], kick_angles: [0, 0, 0], gunangles: [0, 0, 0], gunoffset: [0, 0, 0],
  gunindex: 0, gunframe: 0, blend: [0, 0, 0, 0], fov: 0, rdflags: 0, stats: new Array(d.MAX_STATS).fill(0),
});

const emptyFrame = (): Frame => ({
  valid: false, serverframe: 0, servertime: 0, deltaframe: 0, areabits: new Uint8Array(32),
  playerstate: emptyPlayerState(), parsedPlayerState: createEmptyProtocolPlayerState(), num_entities: 0, parse_entities: 0,
});

/** The engine parser's player state in the C's units: shorts for pmove, blend in 0..1. */
function toPlayerState(ps: ProtocolPlayerState): PlayerState {
  const v = (p: { x: number; y: number; z: number }, scale = 1): Vec3 => [f(p.x * scale), f(p.y * scale), f(p.z * scale)];
  return {
    pmove: {
      pm_type: ps.pm_type,
      origin: v(ps.origin, 8),
      velocity: v(ps.velocity, 8),
      pm_flags: ps.pm_flags,
      pm_time: ps.pm_time,
      gravity: ps.gravity,
      delta_angles: v(ps.delta_angles, 32768 / 180),
    },
    viewangles: v(ps.viewangles),
    viewoffset: v(ps.viewoffset),
    kick_angles: v(ps.kick_angles),
    gunangles: v(ps.gun_angles),
    gunoffset: v(ps.gun_offset),
    gunindex: ps.gun_index,
    gunframe: ps.gun_frame,
    // MSG_ReadByte (&net_message)/255.0, stored in a float
    blend: [f(ps.blend[0] / 255.0), f(ps.blend[1] / 255.0), f(ps.blend[2] / 255.0), f(ps.blend[3] / 255.0)],
    fov: f(ps.fov),
    rdflags: ps.rdflags,
    stats: [...ps.stats],
  };
}

/** What the platform and the network give CL_Frame. */
export interface FrameInput {
  /** Milliseconds since the last Qcommon_Frame. */
  msec: number;
  /** cls.realtime: Sys_Milliseconds at the last read. */
  realtime: number;
  /** The server messages CL_ReadPackets reads, each with the netchan's incoming_acknowledged after it. */
  messages: { data: Uint8Array; ack: number }[];
  /** cls.netchan.incoming_acknowledged and outgoing_sequence when CL_PredictMovement runs. */
  ack: number;
  seq: number;
}

/** An S_StartSound call: what the sound layer will be compared on. */
export interface SoundStart {
  origin: Vec3 | null;
  ent: number;
  channel: number;
  name: string;
  volume: number;
  attenuation: number;
  timeofs: number;
}

export interface FrameOutput {
  /** False when CL_Frame returned early: the time is held for the next call. */
  ran: boolean;
  /** The refdef handed to the renderer, if the frame drew one. */
  refdef?: RefDef;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'active';

export interface ClientOptions {
  assets: ClientAssets;
  /** cl_maxfps (90), cl_predict (1), cl_gun (1), cl_vwep (1), cl_noskins (0), cl_footsteps (1). */
  maxfps?: number;
  footsteps?: boolean;
  predict?: boolean;
  gun?: boolean;
  vwep?: boolean;
  noskins?: boolean;
  /** scr_vrect: the 3D view's rectangle (the whole screen at viewsize 100). */
  vrect?: { x: number; y: number; width: number; height: number };
}

export class OriginalClient {
  // cls
  state: ConnectionState = 'connecting';
  serverProtocol = 0;
  realtime = 0;
  frametime = 0;
  private extratime = 0;
  private ack = 0;

  // cl
  time = 0;
  lerpfrac = 0;
  frame: Frame = emptyFrame();
  frames: Frame[] = Array.from({ length: d.UPDATE_BACKUP }, emptyFrame);
  playernum = 0;
  attractloop = 0;
  servercount = 0;
  refreshPrepped = false;
  forceRefdef = false;
  configstrings: string[] = new Array(d.MAX_CONFIGSTRINGS).fill('');
  modelDraw: (string | null)[] = new Array(d.MAX_MODELS).fill(null);
  clientinfo: ClientInfo[] = Array.from({ length: d.MAX_CLIENTS }, emptyClientInfo);
  baseclientinfo: ClientInfo = emptyClientInfo();
  predictedOrigin: Vec3 = [0, 0, 0];
  predictedAngles: Vec3 = [0, 0, 0];
  predictionError: Vec3 = [0, 0, 0];
  predictedStep = 0;
  predictedStepTime = 0;
  predictedOrigins: Vec3[] = Array.from({ length: d.CMD_BACKUP }, () => [0, 0, 0] as Vec3);
  viewangles: Vec3 = [0, 0, 0];
  refdef: RefDef = OriginalClient.emptyRefdef();
  v_forward: Vec3 = [0, 0, 0];
  v_right: Vec3 = [0, 0, 0];
  v_up: Vec3 = [0, 0, 0];
  private parseEntitiesCount = 0;
  private weaponModels: string[] = ['weapon.md2'];

  readonly entities: CEntity[] = Array.from({ length: d.MAX_EDICTS }, newCEntity);
  readonly parseEntities: EntityState[] = Array.from({ length: d.MAX_PARSE_ENTITIES }, nullState);

  // cl_fx.c's light styles and cl_view.c's r_lightstyles
  private lightstyleMaps: number[][] = Array.from({ length: d.MAX_LIGHTSTYLES }, () => []);
  private lightstyleValues: Vec3[] = Array.from({ length: d.MAX_LIGHTSTYLES }, () => [0, 0, 0] as Vec3);
  private lastofs = -1;
  private readonly rLightstyles: LightStyle[] = Array.from({ length: d.MAX_LIGHTSTYLES }, () => ({ rgb: [0, 0, 0] as Vec3, white: 0 }));

  // the scene being built (cl_view.c's r_entities, r_dlights, r_particles)
  private rEntities: RefEntity[] = [];
  private rDlights: DLight[] = [];
  private rParticles: Particle[] = [];

  /** rand(): the effects' (and the beam colours') random numbers, in the C's order. */
  readonly rand = new Rand();
  readonly fx: ClientEffects;
  /** Every S_StartSound since the last frame, in order. */
  sounds: SoundStart[] = [];

  private readonly assets: ClientAssets;
  private readonly footsteps: boolean;
  private readonly maxfps: number;
  private readonly predict: boolean;
  private readonly gun: boolean;
  private readonly vwep: boolean;
  private readonly noskins: boolean;
  private readonly vrect: { x: number; y: number; width: number; height: number };
  private parserProtocol = 0;

  constructor(options: ClientOptions) {
    this.assets = options.assets;
    this.maxfps = options.maxfps ?? 90;
    this.predict = options.predict ?? true;
    this.gun = options.gun ?? true;
    this.vwep = options.vwep ?? true;
    this.noskins = options.noskins ?? false;
    this.vrect = options.vrect ?? { x: 0, y: 0, width: 640, height: 480 };
    this.footsteps = options.footsteps ?? true;
    this.fx = new ClientEffects(this.fxHost(), this.rand);
  }

  private fxHost(): FxHost {
    const cl = this;
    return {
      get time() { return cl.time; },
      get frametime() { return cl.frametime; },
      get servertime() { return cl.frame.servertime; },
      get lerpfrac() { return cl.lerpfrac; },
      get playernum() { return cl.playernum; },
      get vieworg() { return cl.refdef.vieworg; },
      get footsteps() { return cl.footsteps; },
      entity: (n) => cl.entities[n],
      addEntity: (ent) => cl.addEntity(ent),
      addLight: (org, intensity, r, g, b) => cl.addLight(org, intensity, r, g, b),
      addParticle: (org, color, alpha) => cl.addParticle(org, color, alpha),
      startSound: (origin, ent, channel, name, volume, attenuation, timeofs) => {
        cl.sounds.push({ origin: origin ? [...origin] : null, ent, channel, name, volume, attenuation, timeofs });
      },
    };
  }

  private static emptyRefdef(): RefDef {
    return {
      x: 0, y: 0, width: 0, height: 0, fov_x: 0, fov_y: 0, vieworg: [0, 0, 0], viewangles: [0, 0, 0],
      blend: [0, 0, 0, 0], time: 0, rdflags: 0, areabits: null, lightstyles: [], entities: [], dlights: [], particles: [],
    };
  }

  // ------------------------------------------------------------------ CL_Frame

  /** CL_Frame: reads the messages, predicts, and builds the refdef. */
  runFrame(input: FrameInput): FrameOutput {
    this.extratime += input.msec;
    if (this.state === 'connected' && this.extratime < 100) return { ran: false };
    if (this.extratime < 1000 / this.maxfps) return { ran: false };

    // cls.frametime = extratime/1000.0, a float; capped at a fifth of a second
    this.frametime = f(this.extratime / 1000.0);
    this.time += this.extratime;
    this.realtime = input.realtime;
    this.extratime = 0;
    if (this.frametime > 1.0 / 5) this.frametime = f(1.0 / 5);
    this.sounds = [];

    // CL_ReadPackets
    for (const message of input.messages) {
      this.ack = message.ack;
      this.parseServerMessage(message.data);
    }
    this.ack = input.ack;

    this.predictMovement(input.ack, input.seq);

    if (!this.refreshPrepped && this.state === 'active') this.prepRefresh();

    // SCR_UpdateScreen draws the 3D view through V_RenderView
    const refdef = this.renderView();

    // advance local effects for next frame
    this.fx.runDlights();
    this.runLightStyles();
    return { ran: true, refdef };
  }

  // ------------------------------------------------------------------ parsing (cl_parse.c, cl_ents.c)

  /** CL_ParseServerMessage, through the engine's parser. */
  parseServerMessage(data: Uint8Array): void {
    const parser = new NetworkMessageParser(new BinaryStream(data), this.handler(), true);
    parser.setProtocolVersion(this.parserProtocol);
    parser.parseMessage();
  }

  private handler(): NetworkMessageHandler {
    const ignore = () => {};
    return {
      onServerData: (protocol, serverCount, attractLoop, _gameDir, playerNum) => this.parseServerData(protocol, serverCount, attractLoop, playerNum),
      onConfigString: (index, str) => this.parseConfigString(index, str),
      onSpawnBaseline: (entity) => this.parseBaseline(entity),
      onFrame: (frame) => this.parseFrame(frame),
      onStuffText: (text) => this.stuffText(text),
      onCenterPrint: ignore, onPrint: ignore, onSound: ignore, onLayout: ignore, onInventory: ignore,
      onTempEntity: (type, pos, pos2, dir, cnt, color, ent, srcEnt, destEnt) => {
        const v = (p?: { x: number; y: number; z: number }): Vec3 => (p ? [f(p.x), f(p.y), f(p.z)] : [0, 0, 0]);
        this.fx.tempEntity({ type, pos: v(pos), pos2: v(pos2), dir: v(dir), cnt, color, ent, srcEnt, destEnt });
      },
      onMuzzleFlash: (ent, weapon) => this.fx.muzzleFlash(ent, weapon),
      onMuzzleFlash2: (ent, weapon) => this.fx.muzzleFlash2(ent, weapon),
      onDisconnect: ignore, onReconnect: ignore,
      onDownload: ignore,
    };
  }

  /** CL_ParseServerData: a new server (or a demo's start) clears the client. */
  private parseServerData(protocol: number, serverCount: number, attractLoop: number, playerNum: number): void {
    this.clearState();
    this.state = 'connected';
    this.serverProtocol = protocol;
    this.parserProtocol = protocol;
    this.servercount = serverCount;
    this.attractloop = attractLoop;
    this.playernum = playerNum;
  }

  /** CL_ClearState and CL_ClearEffects' light styles. */
  private clearState(): void {
    this.time = 0;
    this.lerpfrac = 0;
    this.frame = emptyFrame();
    this.frames = Array.from({ length: d.UPDATE_BACKUP }, emptyFrame);
    this.refreshPrepped = false;
    this.forceRefdef = false;
    this.configstrings.fill('');
    this.modelDraw.fill(null);
    this.clientinfo = Array.from({ length: d.MAX_CLIENTS }, emptyClientInfo);
    this.baseclientinfo = emptyClientInfo();
    this.predictedOrigin = [0, 0, 0];
    this.predictedAngles = [0, 0, 0];
    this.predictionError = [0, 0, 0];
    this.predictedStep = 0;
    this.predictedStepTime = 0;
    this.predictedOrigins = Array.from({ length: d.CMD_BACKUP }, () => [0, 0, 0] as Vec3);
    this.viewangles = [0, 0, 0];
    this.refdef = OriginalClient.emptyRefdef();
    this.parseEntitiesCount = 0;
    for (let i = 0; i < d.MAX_EDICTS; i++) this.entities[i] = newCEntity();
    this.lightstyleMaps = Array.from({ length: d.MAX_LIGHTSTYLES }, () => []);
    this.lightstyleValues = Array.from({ length: d.MAX_LIGHTSTYLES }, () => [0, 0, 0] as Vec3);
    this.lastofs = -1;
    this.fx.clear();
  }

  private parseConfigString(index: number, str: string): void {
    if (index < 0 || index >= d.MAX_CONFIGSTRINGS) throw new Error('configstring > MAX_CONFIGSTRINGS');
    this.configstrings[index] = str;
    if (index >= d.CS_LIGHTS && index < d.CS_LIGHTS + d.MAX_LIGHTSTYLES) this.setLightstyle(index - d.CS_LIGHTS);
    else if (index >= d.CS_MODELS && index < d.CS_MODELS + d.MAX_MODELS) {
      if (this.refreshPrepped) this.modelDraw[index - d.CS_MODELS] = this.registerModel(str);
    } else if (index >= d.CS_PLAYERSKINS && index < d.CS_PLAYERSKINS + d.MAX_CLIENTS) {
      if (this.refreshPrepped) this.loadClientinfo(this.clientinfo[index - d.CS_PLAYERSKINS], str);
    }
  }

  /** CL_ParseBaseline: the delta from a zeroed state. */
  private parseBaseline(entity: ParsedEntity): void {
    this.entities[entity.number].baseline = this.parseDelta(nullState(), entity, entity.number);
  }

  private stuffText(text: string): void {
    // "precache" ends the downloads; CL_RequestNextDownload then registers everything.
    if (/^\s*precache\b/.test(text) && this.state !== 'disconnected') this.prepRefresh();
  }

  /**
   * CL_ParseDelta: the old state with the fields the bits say were sent. The engine's parser reads
   * each delta onto an empty state, so its fields are taken where the bits name them.
   */
  private parseDelta(from: EntityState, read: ParsedEntity, number: number): EntityState {
    const bits = read.bits;
    const to = copyState(from);
    to.old_origin = [...from.origin];
    to.number = number;
    if (bits & d.U_MODEL) to.modelindex = read.modelindex;
    if (bits & d.U_MODEL2) to.modelindex2 = read.modelindex2;
    if (bits & d.U_MODEL3) to.modelindex3 = read.modelindex3;
    if (bits & d.U_MODEL4) to.modelindex4 = read.modelindex4;
    if (bits & (d.U_FRAME8 | d.U_FRAME16)) to.frame = read.frame;
    if (bits & (d.U_SKIN8 | d.U_SKIN16)) to.skinnum = read.skinnum;
    if (bits & (d.U_EFFECTS8 | d.U_EFFECTS16)) to.effects = read.effects >>> 0;
    if (bits & (d.U_RENDERFX8 | d.U_RENDERFX16)) to.renderfx = read.renderfx;
    if (bits & d.U_ORIGIN1) to.origin[0] = f(read.origin.x);
    if (bits & d.U_ORIGIN2) to.origin[1] = f(read.origin.y);
    if (bits & d.U_ORIGIN3) to.origin[2] = f(read.origin.z);
    if (bits & d.U_ANGLE1) to.angles[0] = f(read.angles.x);
    if (bits & d.U_ANGLE2) to.angles[1] = f(read.angles.y);
    if (bits & d.U_ANGLE3) to.angles[2] = f(read.angles.z);
    if (bits & d.U_OLDORIGIN) to.old_origin = [f(read.old_origin.x), f(read.old_origin.y), f(read.old_origin.z)];
    if (bits & d.U_SOUND) to.sound = read.sound;
    to.event = bits & d.U_EVENT ? read.event : 0;
    if (bits & d.U_SOLID) to.solid = read.solid;
    return to;
  }

  /** CL_DeltaEntity: adds the entity to the frame and moves its centity's states along. */
  private deltaEntity(frame: Frame, newnum: number, old: EntityState, read: ParsedEntity | null): void {
    const ent = this.entities[newnum];
    const state = read ? this.parseDelta(old, read, newnum) : this.parseDelta(old, { ...createEmptyEntityState(), bits: 0 }, newnum);
    this.parseEntities[this.parseEntitiesCount & (d.MAX_PARSE_ENTITIES - 1)] = state;
    this.parseEntitiesCount++;
    frame.num_entities++;

    // abs() of a float difference: the C converts it to an int first
    const far = (i: number) => Math.abs(Math.trunc(f(state.origin[i] - ent.current.origin[i]))) > 512;
    if (state.modelindex !== ent.current.modelindex || state.modelindex2 !== ent.current.modelindex2
      || state.modelindex3 !== ent.current.modelindex3 || state.modelindex4 !== ent.current.modelindex4
      || far(0) || far(1) || far(2)
      || state.event === d.EV_PLAYER_TELEPORT || state.event === d.EV_OTHER_TELEPORT) {
      ent.serverframe = -99;
    }

    if (ent.serverframe !== this.frame.serverframe - 1) {
      // wasn't in last update, so initialize some things
      ent.trailcount = 1024;
      ent.prev = copyState(state);
      if (state.event === d.EV_OTHER_TELEPORT) {
        ent.prev.origin = [...state.origin];
        ent.lerp_origin = [...state.origin];
      } else {
        ent.prev.origin = [...state.old_origin];
        ent.lerp_origin = [...state.old_origin];
      }
    } else {
      ent.prev = ent.current;
    }
    ent.serverframe = this.frame.serverframe;
    ent.current = state;
  }

  /** CL_ParsePacketEntities: the old frame's entities merged with this packet's deltas and removals. */
  private parsePacketEntities(oldframe: Frame | null, newframe: Frame, packet: FrameData['packetEntities']): void {
    newframe.parse_entities = this.parseEntitiesCount;
    newframe.num_entities = 0;
    const olds: EntityState[] = [];
    if (oldframe) {
      for (let i = 0; i < oldframe.num_entities; i++) {
        olds.push(this.parseEntities[(oldframe.parse_entities + i) & (d.MAX_PARSE_ENTITIES - 1)]);
      }
    }
    const reads = [...packet.entities].sort((a, b) => a.number - b.number);
    const removed = new Set(packet.removed ?? []);
    let oi = 0;
    const oldnum = () => (oi < olds.length ? olds[oi].number : 99999);
    let ri = 0;
    const changes = [...reads.map((r) => r.number), ...removed].sort((a, b) => a - b);
    for (const newnum of changes) {
      while (oldnum() < newnum) {
        // one or more entities from the old packet are unchanged
        this.deltaEntity(newframe, oldnum(), olds[oi], null);
        oi++;
      }
      if (removed.has(newnum)) {
        // the entity present in oldframe is not in the current frame
        if (oldnum() === newnum) oi++;
        continue;
      }
      const read = reads[ri++];
      if (oldnum() === newnum) {
        // delta from previous state
        this.deltaEntity(newframe, newnum, olds[oi], read);
        oi++;
      } else {
        // delta from baseline
        this.deltaEntity(newframe, newnum, this.entities[newnum].baseline, read);
      }
    }
    // any remaining entities in the old frame are copied over
    while (oi < olds.length) {
      this.deltaEntity(newframe, olds[oi].number, olds[oi], null);
      oi++;
    }
  }

  /** CL_ParseFrame. */
  private parseFrame(data: FrameData): void {
    const frame = emptyFrame();
    frame.serverframe = data.serverFrame;
    frame.deltaframe = data.deltaFrame;
    frame.servertime = frame.serverframe * 100;
    this.frame = frame;

    let old: Frame | null = null;
    if (frame.deltaframe <= 0) {
      frame.valid = true;
    } else {
      old = this.frames[frame.deltaframe & d.UPDATE_MASK];
      if (old.serverframe !== frame.deltaframe) {
        // the frame the server did the delta from is too old
      } else if (this.parseEntitiesCount - old.parse_entities > d.MAX_PARSE_ENTITIES - 128) {
        // delta parse_entities too old
      } else frame.valid = true;
    }

    // clamp time
    if (this.time > frame.servertime) this.time = frame.servertime;
    else if (this.time < frame.servertime - 100) this.time = frame.servertime - 100;

    frame.areabits = new Uint8Array(32);
    frame.areabits.set(data.areaBits.subarray(0, 32));

    // CL_ParsePlayerstate: from the delta frame's state, or from zero
    frame.parsedPlayerState = deltaPlayerState(old ? old.parsedPlayerState : createEmptyProtocolPlayerState(), data.playerState);
    if (this.attractloop) frame.parsedPlayerState.pm_type = d.PM_FREEZE; // demo playback
    frame.playerstate = toPlayerState(frame.parsedPlayerState);

    this.parsePacketEntities(old, frame, data.packetEntities);

    // save the frame off in the backup array for later delta comparisons
    this.frames[frame.serverframe & d.UPDATE_MASK] = frame;

    if (frame.valid) {
      if (this.state !== 'active') {
        this.state = 'active';
        this.forceRefdef = true;
        const o = frame.playerstate.pmove.origin;
        this.predictedOrigin = [f(o[0] * 0.125), f(o[1] * 0.125), f(o[2] * 0.125)];
        this.predictedAngles = [...frame.playerstate.viewangles];
      }
      this.fireEntityEvents(frame);
      this.checkPredictionError();
    }
  }

  /** CL_FireEntityEvents. */
  private fireEntityEvents(frame: Frame): void {
    for (let pnum = 0; pnum < frame.num_entities; pnum++) {
      const s1 = this.parseEntities[(frame.parse_entities + pnum) & (d.MAX_PARSE_ENTITIES - 1)];
      if (s1.event) this.fx.entityEvent(s1);
      // EF_TELEPORTER acts like an event, but is not cleared each frame
      if (s1.effects & d.EF_TELEPORTER) this.fx.teleporterParticles(s1);
    }
  }

  // ------------------------------------------------------------------ prediction (cl_pred.c)

  /** CL_CheckPredictionError. */
  private checkPredictionError(): void {
    if (!this.predict || (this.frame.playerstate.pmove.pm_flags & d.PMF_NO_PREDICTION)) return;
    const frame = this.ack & (d.CMD_BACKUP - 1);
    const origin = this.frame.playerstate.pmove.origin;
    const delta = [0, 1, 2].map((i) => origin[i] - this.predictedOrigins[frame][i]);
    const len = Math.abs(delta[0]) + Math.abs(delta[1]) + Math.abs(delta[2]);
    if (len > 640) {
      this.predictionError = [0, 0, 0];
    } else {
      this.predictedOrigins[frame] = [...origin];
      this.predictionError = [f(delta[0] * 0.125), f(delta[1] * 0.125), f(delta[2] * 0.125)];
    }
  }

  /** CL_PredictMovement. Only a frozen player is predicted here: pmove.c is not ported yet. */
  private predictMovement(ack: number, current: number): void {
    if (this.state !== 'active') return;
    const ps = this.frame.playerstate;
    if (!this.predict || (ps.pmove.pm_flags & d.PMF_NO_PREDICTION)) {
      for (let i = 0; i < 3; i++) this.predictedAngles[i] = f(this.viewangles[i] + short2angle(ps.pmove.delta_angles[i]));
      return;
    }
    if (current - ack >= d.CMD_BACKUP) return;
    if (ps.pmove.pm_type !== d.PM_FREEZE) {
      throw new Error(`CL_PredictMovement: pm_type ${ps.pmove.pm_type} needs pmove.c, which is not ported`);
    }
    // Pmove with PM_FREEZE: PM_ClampAngles, then no movement at all
    const s = ps.pmove;
    let viewangles: Vec3 = [0, 0, 0];
    while (++ack < current) {
      const frame = ack & (d.CMD_BACKUP - 1);
      // the commands carry the client's own view angles (cl.viewangles, never turned here)
      viewangles = this.clampAngles(s, this.viewangles);
      this.predictedOrigins[frame] = [...s.origin];
    }
    const oldframe = (ack - 2) & (d.CMD_BACKUP - 1);
    const oldz = this.predictedOrigins[oldframe][2];
    const step = s.origin[2] - oldz;
    if (step > 63 && step < 160 && (s.pm_flags & d.PMF_ON_GROUND)) {
      this.predictedStep = f(step * 0.125);
      // cls.realtime - cls.frametime * 500, stored in an unsigned
      this.predictedStepTime = Math.trunc(this.realtime - this.frametime * 500) >>> 0;
    }
    this.predictedOrigin = [f(s.origin[0] * 0.125), f(s.origin[1] * 0.125), f(s.origin[2] * 0.125)];
    this.predictedAngles = viewangles;
  }

  /** PM_ClampAngles on a command built from the client's view angles (ANGLE2SHORT). */
  private clampAngles(s: PlayerState['pmove'], angles: Vec3): Vec3 {
    const cmd = angles.map((a) => Math.trunc(a * 65536 / 360) & 65535);
    const short = (x: number) => ((x & 0xffff) << 16) >> 16;
    if (s.pm_flags & d.PMF_TIME_TELEPORT) {
      return [0, short2angle(short(cmd[1] + s.delta_angles[1])), 0];
    }
    const v = [0, 1, 2].map((i) => short2angle(short(cmd[i] + s.delta_angles[i]))) as Vec3;
    if (v[0] > 89 && v[0] < 180) v[0] = 89;
    else if (v[0] < 271 && v[0] >= 180) v[0] = 271;
    return v;
  }

  // ------------------------------------------------------------------ registration (cl_view.c CL_PrepRefresh, cl_parse.c)

  private registerModel(name: string): string | null {
    if (!name) return null;
    if (name.startsWith('*')) return name;
    return this.assets.hasModel(name) ? name : null;
  }

  private registerSkin(name: string): string | null {
    return this.assets.hasSkin(name) ? name : null;
  }

  /** CL_PrepRefresh's model and client registration. */
  prepRefresh(): void {
    if (!this.configstrings[d.CS_MODELS + 1]) return; // no map loaded
    this.weaponModels = ['weapon.md2'];
    for (let i = 1; i < d.MAX_MODELS && this.configstrings[d.CS_MODELS + i]; i++) {
      const name = this.configstrings[d.CS_MODELS + i];
      if (name.startsWith('#')) {
        if (this.weaponModels.length < d.MAX_CLIENTWEAPONMODELS) this.weaponModels.push(name.slice(1));
      } else {
        this.modelDraw[i] = this.registerModel(name);
      }
    }
    for (let i = 0; i < d.MAX_CLIENTS; i++) {
      if (!this.configstrings[d.CS_PLAYERSKINS + i]) continue;
      this.loadClientinfo(this.clientinfo[i], this.configstrings[d.CS_PLAYERSKINS + i]);
    }
    this.fx.registerModels((name) => this.registerModel(name));
    this.loadClientinfo(this.baseclientinfo, 'unnamed\\male/grunt');
    this.refreshPrepped = true;
    this.forceRefdef = true;
  }

  /** CL_LoadClientinfo. */
  private loadClientinfo(ci: ClientInfo, s: string): void {
    ci.cinfo = s.slice(0, d.MAX_QPATH - 1);
    const slash = s.indexOf('\\');
    ci.name = slash >= 0 ? s.slice(0, slash) : s;
    if (slash >= 0) s = s.slice(slash + 1);
    ci.weaponmodel = new Array(d.MAX_CLIENTWEAPONMODELS).fill(null);
    if (this.noskins || !s) {
      ci.model = this.registerModel('players/male/tris.md2');
      ci.weaponmodel[0] = this.registerModel('players/male/weapon.md2');
      ci.skin = this.registerSkin('players/male/grunt.pcx');
      ci.iconname = '/players/male/grunt_i.pcx';
      ci.icon = this.assets.hasPic(ci.iconname) ? ci.iconname : null;
    } else {
      const cut = s.indexOf('/') >= 0 ? s.indexOf('/') : s.indexOf('\\') >= 0 ? s.indexOf('\\') : 0;
      let modelName = s.slice(0, cut);
      const skinName = s.slice(modelName.length + 1);
      ci.model = this.registerModel(`players/${modelName}/tris.md2`);
      if (!ci.model) {
        modelName = 'male';
        ci.model = this.registerModel('players/male/tris.md2');
      }
      ci.skin = this.registerSkin(`players/${modelName}/${skinName}.pcx`);
      if (!ci.skin && modelName.toLowerCase() !== 'male') {
        modelName = 'male';
        ci.model = this.registerModel('players/male/tris.md2');
        ci.skin = this.registerSkin(`players/${modelName}/${skinName}.pcx`);
      }
      if (!ci.skin) ci.skin = this.registerSkin(`players/${modelName}/grunt.pcx`);
      for (let i = 0; i < this.weaponModels.length; i++) {
        ci.weaponmodel[i] = this.registerModel(`players/${modelName}/${this.weaponModels[i]}`);
        if (!ci.weaponmodel[i] && modelName === 'cyborg') ci.weaponmodel[i] = this.registerModel(`players/male/${this.weaponModels[i]}`);
        if (!this.vwep) break;
      }
      ci.iconname = `/players/${modelName}/${skinName}_i.pcx`;
      ci.icon = this.assets.hasPic(ci.iconname) ? ci.iconname : null;
    }
    if (!ci.skin || !ci.icon || !ci.model || !ci.weaponmodel[0]) {
      ci.skin = null;
      ci.icon = null;
      ci.model = null;
      ci.weaponmodel[0] = null;
    }
  }

  // ------------------------------------------------------------------ light styles (cl_fx.c)

  private setLightstyle(i: number): void {
    const s = this.configstrings[i + d.CS_LIGHTS];
    if (s.length >= d.MAX_QPATH) throw new Error(`svc_lightstyle length=${s.length}`);
    // (float)(s[k]-'a')/(float)('m'-'a')
    this.lightstyleMaps[i] = [...s].map((c) => f((c.charCodeAt(0) - 97) / 12));
  }

  /** CL_RunLightStyles: ten steps a second. */
  private runLightStyles(): void {
    const ofs = Math.trunc(this.time / 100);
    if (ofs === this.lastofs) return;
    this.lastofs = ofs;
    for (let i = 0; i < d.MAX_LIGHTSTYLES; i++) {
      const map = this.lightstyleMaps[i];
      const v = !map.length ? 1 : map.length === 1 ? map[0] : map[ofs % map.length];
      this.lightstyleValues[i] = [v, v, v];
    }
  }

  /** CL_AddLightStyles through V_AddLightStyle. */
  private addLightStyles(): void {
    for (let i = 0; i < d.MAX_LIGHTSTYLES; i++) {
      const [r, g, b] = this.lightstyleValues[i];
      this.rLightstyles[i] = { rgb: [r, g, b], white: f(f(r + g) + b) };
    }
  }

  // ------------------------------------------------------------------ building the refdef (cl_ents.c, cl_view.c)

  private addEntity(ent: RefEntity): void {
    if (this.rEntities.length >= d.MAX_ENTITIES) return;
    this.rEntities.push({ ...ent, origin: [...ent.origin], oldorigin: [...ent.oldorigin], angles: [...ent.angles] });
  }

  private addLight(org: Vec3, intensity: number, r: number, g: number, b: number): void {
    if (this.rDlights.length >= d.MAX_DLIGHTS) return;
    this.rDlights.push({ origin: [...org], intensity: f(intensity), color: [f(r), f(g), f(b)] });
  }

  private addParticle(org: Vec3, color: number, alpha: number): void {
    if (this.rParticles.length >= d.MAX_PARTICLES) return;
    this.rParticles.push({ origin: [...org], color, alpha });
  }

  /** CL_AddPacketEntities. */
  private addPacketEntities(frame: Frame): void {
    // bonus items rotate at a fixed rate
    const autorotate = anglemod(Math.trunc(this.time / 10));
    // brush models can auto animate their frames
    const autoanim = Math.trunc((2 * this.time) / 1000);

    const ent: RefEntity = {
      model: null, angles: [0, 0, 0], origin: [0, 0, 0], frame: 0, oldorigin: [0, 0, 0], oldframe: 0,
      backlerp: 0, skinnum: 0, lightstyle: 0, alpha: 0, skin: null, flags: 0,
    };

    for (let pnum = 0; pnum < frame.num_entities; pnum++) {
      const s1 = this.parseEntities[(frame.parse_entities + pnum) & (d.MAX_PARSE_ENTITIES - 1)];
      const cent = this.entities[s1.number];
      let effects = s1.effects >>> 0;
      let renderfx = s1.renderfx;

      // set frame
      if (effects & d.EF_ANIM01) ent.frame = autoanim & 1;
      else if (effects & d.EF_ANIM23) ent.frame = 2 + (autoanim & 1);
      else if (effects & d.EF_ANIM_ALL) ent.frame = autoanim;
      else if (effects & d.EF_ANIM_ALLFAST) ent.frame = Math.trunc(this.time / 100);
      else ent.frame = s1.frame;

      // quad and pent can do different things on client
      if (effects & d.EF_PENT) { effects = ((effects & ~d.EF_PENT) | d.EF_COLOR_SHELL) >>> 0; renderfx |= d.RF_SHELL_RED; }
      if (effects & d.EF_QUAD) { effects = ((effects & ~d.EF_QUAD) | d.EF_COLOR_SHELL) >>> 0; renderfx |= d.RF_SHELL_BLUE; }
      if (effects & d.EF_DOUBLE) { effects = ((effects & ~d.EF_DOUBLE) | d.EF_COLOR_SHELL) >>> 0; renderfx |= d.RF_SHELL_DOUBLE; }
      if (effects & d.EF_HALF_DAMAGE) { effects = ((effects & ~d.EF_HALF_DAMAGE) | d.EF_COLOR_SHELL) >>> 0; renderfx |= d.RF_SHELL_HALF_DAM; }

      ent.oldframe = cent.prev.frame;
      ent.backlerp = f(1.0 - this.lerpfrac);

      if (renderfx & (d.RF_FRAMELERP | d.RF_BEAM)) {
        // step origin discretely, because the frames do the animation properly
        ent.origin = [...cent.current.origin];
        ent.oldorigin = [...cent.current.old_origin];
      } else {
        // interpolate origin
        for (let i = 0; i < 3; i++) {
          ent.origin[i] = ent.oldorigin[i] = f(cent.prev.origin[i] + f(this.lerpfrac * f(cent.current.origin[i] - cent.prev.origin[i])));
        }
      }

      if (renderfx & d.RF_BEAM) {
        // the four beam colors are encoded in 32 bits of skinnum (hack)
        ent.alpha = f(0.3);
        ent.skinnum = (s1.skinnum >> ((this.rand.rand() % 4) * 8)) & 0xff;
        ent.model = null;
      } else if (s1.modelindex === 255) {
        // use custom player skin
        ent.skinnum = 0;
        const ci = this.clientinfo[s1.skinnum & 0xff];
        ent.skin = ci.skin;
        ent.model = ci.model;
        if (!ent.skin || !ent.model) {
          ent.skin = this.baseclientinfo.skin;
          ent.model = this.baseclientinfo.model;
        }
      } else {
        ent.skinnum = s1.skinnum;
        ent.skin = null;
        ent.model = this.modelDraw[s1.modelindex];
      }

      // only used for black hole model right now, FIXME: do better
      if (renderfx === d.RF_TRANSLUCENT) ent.alpha = f(0.7);

      // render effects (fullbright, translucent, etc)
      ent.flags = effects & d.EF_COLOR_SHELL ? 0 : renderfx;

      // calculate angles
      if (effects & d.EF_ROTATE) {
        ent.angles = [0, autorotate, 0];
      } else if (effects & d.EF_SPINNINGLIGHTS) {
        ent.angles = [0, f(anglemod(Math.trunc(this.time / 2)) + s1.angles[1]), 180];
        const { forward } = angleVectors(ent.angles);
        this.addLight(vectorMA(ent.origin, 64, forward), 100, 1, 0, 0);
      } else {
        for (let i = 0; i < 3; i++) ent.angles[i] = lerpAngle(cent.prev.angles[i], cent.current.angles[i], this.lerpfrac);
      }

      if (s1.number === this.playernum + 1) {
        ent.flags |= d.RF_VIEWERMODEL; // only draw from mirrors
        if (effects & d.EF_FLAG1) this.addLight(ent.origin, 225, 1.0, 0.1, 0.1);
        else if (effects & d.EF_FLAG2) this.addLight(ent.origin, 225, 0.1, 0.1, 1.0);
        else if (effects & d.EF_TAGTRAIL) this.addLight(ent.origin, 225, 1.0, 1.0, 0.0);
        else if (effects & d.EF_TRACKERTRAIL) this.addLight(ent.origin, 225, -1.0, -1.0, -1.0);
        continue;
      }

      // if set to invisible, skip
      if (!s1.modelindex) continue;

      if (effects & d.EF_BFG) { ent.flags |= d.RF_TRANSLUCENT; ent.alpha = f(0.3); }
      if (effects & d.EF_PLASMA) { ent.flags |= d.RF_TRANSLUCENT; ent.alpha = f(0.6); }
      if (effects & d.EF_SPHERETRANS) {
        ent.flags |= d.RF_TRANSLUCENT;
        ent.alpha = effects & d.EF_TRACKERTRAIL ? f(0.6) : f(0.3);
      }

      // add to refresh list
      this.addEntity(ent);

      // color shells generate a seperate entity for the main model
      if (effects & d.EF_COLOR_SHELL) {
        ent.flags = renderfx | d.RF_TRANSLUCENT;
        ent.alpha = f(0.3);
        this.addEntity(ent);
      }

      ent.skin = null; // never use a custom skin on others
      ent.skinnum = 0;
      ent.flags = 0;
      ent.alpha = 0;

      // duplicate for linked models
      if (s1.modelindex2) {
        if (s1.modelindex2 === 255) {
          // custom weapon
          const ci = this.clientinfo[s1.skinnum & 0xff];
          let i = s1.skinnum >> 8; // 0 is default weapon model
          if (!this.vwep || i > d.MAX_CLIENTWEAPONMODELS - 1) i = 0;
          ent.model = ci.weaponmodel[i];
          if (!ent.model) {
            if (i !== 0) ent.model = ci.weaponmodel[0];
            if (!ent.model) ent.model = this.baseclientinfo.weaponmodel[0];
          }
        } else if (s1.modelindex2 & 0x80) {
          // translucent linked models (defender sphere's shell): cl_ents.c's own hack (PGM), so a
          // linked model index from 128 to 254 is drawn from slot & 0x7f, translucent, as the C does
          ent.model = this.modelDraw[s1.modelindex2 & 0x7f];
          ent.alpha = f(0.32);
          ent.flags = d.RF_TRANSLUCENT;
        } else {
          ent.model = this.modelDraw[s1.modelindex2];
        }
        this.addEntity(ent);
        ent.flags = 0;
        ent.alpha = 0;
      }
      if (s1.modelindex3) {
        ent.model = this.modelDraw[s1.modelindex3];
        this.addEntity(ent);
      }
      if (s1.modelindex4) {
        ent.model = this.modelDraw[s1.modelindex4];
        this.addEntity(ent);
      }

      // EF_POWERSCREEN, particle trails and the lights that go with them
      this.fx.entityEffects(cent, s1, effects, ent);

      cent.lerp_origin = [...ent.origin];
    }
  }

  /** CL_AddViewWeapon. */
  private addViewWeapon(ps: PlayerState, ops: PlayerState): void {
    if (!this.gun) return;
    // don't draw gun if in wide angle view
    if (ps.fov > 90) return;
    const model = this.modelDraw[ps.gunindex];
    if (!model) return;
    const lerp = this.lerpfrac;
    const origin: Vec3 = [0, 0, 0];
    const angles: Vec3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
      origin[i] = f(f(this.refdef.vieworg[i] + ops.gunoffset[i]) + f(lerp * f(ps.gunoffset[i] - ops.gunoffset[i])));
      angles[i] = f(this.refdef.viewangles[i] + lerpAngle(ops.gunangles[i], ps.gunangles[i], lerp));
    }
    const frame = ps.gunframe;
    this.addEntity({
      model, origin, angles, oldorigin: [...origin], frame,
      // just changed weapons, don't lerp from old
      oldframe: frame === 0 ? 0 : ops.gunframe,
      flags: d.RF_MINLIGHT | d.RF_DEPTHHACK | d.RF_WEAPONMODEL,
      backlerp: f(1.0 - lerp), skinnum: 0, lightstyle: 0, alpha: 0, skin: null,
    });
  }

  /** CL_CalcViewValues. */
  private calcViewValues(): void {
    const ps = this.frame.playerstate;
    let oldframe = this.frames[(this.frame.serverframe - 1) & d.UPDATE_MASK];
    if (oldframe.serverframe !== this.frame.serverframe - 1 || !oldframe.valid) oldframe = this.frame; // previous frame was dropped or invalid
    let ops = oldframe.playerstate;

    // see if the player entity was teleported this frame
    if (Math.abs(ops.pmove.origin[0] - ps.pmove.origin[0]) > 256 * 8
      || Math.abs(ops.pmove.origin[1] - ps.pmove.origin[1]) > 256 * 8
      || Math.abs(ops.pmove.origin[2] - ps.pmove.origin[2]) > 256 * 8) ops = ps; // don't interpolate

    const lerp = this.lerpfrac;
    const rd = this.refdef;
    if (this.predict && !(ps.pmove.pm_flags & d.PMF_NO_PREDICTION)) {
      // use predicted values
      const backlerp = f(1.0 - lerp);
      for (let i = 0; i < 3; i++) {
        rd.vieworg[i] = f(f(f(this.predictedOrigin[i] + ops.viewoffset[i]) + f(lerp * f(ps.viewoffset[i] - ops.viewoffset[i]))) - f(backlerp * this.predictionError[i]));
      }
      // smooth out stair climbing
      const delta = (this.realtime - this.predictedStepTime) >>> 0;
      // a float times an unsigned, then the double 0.01: the subtraction is in doubles
      if (delta < 100) rd.vieworg[2] = f(rd.vieworg[2] - f(this.predictedStep * (100 - delta)) * 0.01);
    } else {
      // just use interpolated values: shorts times the double 0.125, so in doubles
      for (let i = 0; i < 3; i++) {
        const o = ops.pmove.origin[i] * 0.125 + ops.viewoffset[i];
        rd.vieworg[i] = f(o + lerp * (ps.pmove.origin[i] * 0.125 + ps.viewoffset[i] - o));
      }
    }

    if (ps.pmove.pm_type < d.PM_DEAD) {
      for (let i = 0; i < 3; i++) rd.viewangles[i] = this.predictedAngles[i];
    } else {
      for (let i = 0; i < 3; i++) rd.viewangles[i] = lerpAngle(ops.viewangles[i], ps.viewangles[i], lerp);
    }
    for (let i = 0; i < 3; i++) rd.viewangles[i] = f(rd.viewangles[i] + lerpAngle(ops.kick_angles[i], ps.kick_angles[i], lerp));

    const v = angleVectors(rd.viewangles);
    this.v_forward = v.forward;
    this.v_right = v.right;
    this.v_up = v.up;

    // interpolate field of view
    rd.fov_x = f(ops.fov + f(lerp * f(ps.fov - ops.fov)));
    // don't interpolate blend color
    rd.blend = [...ps.blend];

    this.addViewWeapon(ps, ops);
  }

  /** CL_AddEntities. */
  private addEntities(): void {
    if (this.state !== 'active') return;
    const servertime = this.frame.servertime;
    if (this.time > servertime) {
      this.time = servertime;
      this.lerpfrac = 1.0;
    } else if (this.time < servertime - 100) {
      this.time = servertime - 100;
      this.lerpfrac = 0;
    } else {
      // 1.0 - (cl.frame.servertime - cl.time) * 0.01: ints and doubles, stored in a float
      this.lerpfrac = f(1.0 - (servertime - this.time) * 0.01);
    }
    this.calcViewValues();
    this.addPacketEntities(this.frame);
    this.fx.addTEnts();
    this.fx.addParticles();
    this.fx.addDlights();
    this.addLightStyles();
  }

  /** CalcFov. */
  static calcFov(fovX: number, width: number, height: number): number {
    if (fovX < 1 || fovX > 179) throw new Error(`Bad fov: ${fovX}`);
    // fov_x/360 is a float division; the tangent and arctangent are in doubles
    const x = f(width / Math.tan(f(fovX / 360) * Math.PI));
    const a = f(Math.atan(f(height / x)));
    return f(f(a * 360) / Math.PI);
  }

  /** V_RenderView: the refdef for this frame, or undefined while loading. */
  private renderView(): RefDef | undefined {
    if (this.state !== 'active' || !this.refreshPrepped) return undefined;
    // an invalid frame will just use the exact previous refdef
    if (this.frame.valid) {
      this.forceRefdef = false;
      this.rEntities = [];
      this.rDlights = [];
      this.rParticles = [];
      this.addEntities();
      const rd = this.refdef;
      // never let it sit exactly on a node line: add 1/16 in each axis
      for (let i = 0; i < 3; i++) rd.vieworg[i] = f(rd.vieworg[i] + 1.0 / 16);
      rd.x = this.vrect.x;
      rd.y = this.vrect.y;
      rd.width = this.vrect.width;
      rd.height = this.vrect.height;
      rd.fov_y = OriginalClient.calcFov(rd.fov_x, rd.width, rd.height);
      rd.time = f(this.time * 0.001);
      rd.areabits = this.frame.areabits;
      rd.entities = this.rEntities;
      rd.dlights = this.rDlights;
      rd.particles = this.rParticles;
      rd.lightstyles = this.rLightstyles.map((l) => ({ rgb: [...l.rgb], white: l.white }));
      rd.rdflags = this.frame.playerstate.rdflags;
    }
    return { ...this.refdef, vieworg: [...this.refdef.vieworg], viewangles: [...this.refdef.viewangles] };
  }
}
