/**
 * The original client's effects, ported from id's 3.21 client/cl_fx.c and client/cl_tent.c: dynamic
 * lights, muzzle flashes, particles and particle trails, entity events, and the temporary entities
 * (explosions, beams, lasers) the server sends as svc_temp_entity.
 *
 * Every number is a 32-bit float as in the C (see qmath.ts), and every random number comes from
 * `Rand`, the generator the original Windows builds used, drawn in the C's order (including the
 * draws that only pick a sound). The demo lockstep oracle builds id's client with the same generator,
 * so the particles, lights and temp entities it draws can be compared exactly.
 *
 * The particle list is the C's: new particles go on the head of the active list and CL_AddParticles
 * walks it from the head, so the refdef lists them in the order the C does.
 *
 * Not ported: the Rogue mission pack's effects in cl_newfx.c (tracker, heat beam, steam, widow and
 * nuke effects, the second blaster's particles, lightning) and its sustained effects. They throw, so
 * a demo that needs them fails loudly instead of drawing nothing.
 */
import { ANORMS } from '@quake2ts/shared';
import * as d from './defs.js';
import * as t from './tables.js';
import {
  angleVectors, crossProduct, dot, f, vectorLength, vectorMA, vectorNormalize, vectorScale, vectorSubtract,
  type Rand, type Vec3,
} from './qmath.js';
import type { EntityState, RefEntity } from './client.js';

export const PARTICLE_GRAVITY = 40;
export const INSTANT_PARTICLE = -10000.0;
const MAX_EXPLOSIONS = 32;
const MAX_BEAMS = 32;
const MAX_LASERS = 32;
const NUMVERTEXNORMALS = 162;
const BEAMLENGTH = 16;

export const CHAN_AUTO = 0;
export const CHAN_WEAPON = 1;
export const CHAN_VOICE = 2;
export const CHAN_ITEM = 3;
export const CHAN_BODY = 4;
export const ATTN_NONE = 0;
export const ATTN_NORM = 1;
export const ATTN_IDLE = 2;
export const ATTN_STATIC = 3;

/** bytedirs (anorms.h) as floats. */
const bytedirs: Vec3[] = ANORMS.map((n) => [f(n[0]), f(n[1]), f(n[2])] as Vec3);

/** The parts of a centity_t the effects read and write. */
export interface FxEntity {
  current: EntityState;
  trailcount: number;
  fly_stoptime: number;
  lerp_origin: Vec3;
}

/** What the effects need from the rest of the client. */
export interface FxHost {
  /** cl.time, cls.frametime, cl.frame.servertime, cl.lerpfrac, cl.playernum. */
  readonly time: number;
  readonly frametime: number;
  readonly servertime: number;
  readonly lerpfrac: number;
  readonly playernum: number;
  /** cl.refdef.vieworg as CL_AddEntities leaves it. */
  readonly vieworg: Vec3;
  /** cl_footsteps. */
  readonly footsteps: boolean;
  entity(n: number): FxEntity;
  addEntity(ent: RefEntity): void;
  addLight(org: Vec3, intensity: number, r: number, g: number, b: number): void;
  addParticle(org: Vec3, color: number, alpha: number): void;
  /** S_StartSound with the sound's name (S_RegisterSound's argument). */
  startSound(origin: Vec3 | null, ent: number, channel: number, name: string, volume: number, attenuation: number, timeofs: number): void;
}

/** cdlight_t. */
interface CDLight {
  key: number;
  color: Vec3;
  origin: Vec3;
  radius: number;
  die: number;
  decay: number;
  minlight: number;
}

const emptyDlight = (): CDLight => ({ key: 0, color: [0, 0, 0], origin: [0, 0, 0], radius: 0, die: 0, decay: 0, minlight: 0 });

/** cparticle_t. */
export interface CParticle {
  time: number;
  org: Vec3;
  vel: Vec3;
  accel: Vec3;
  color: number;
  colorvel: number;
  alpha: number;
  alphavel: number;
}

const enum Ex { free, explosion, misc, flash, mflash, poly, poly2 }

/** explosion_t. */
interface Explosion {
  type: Ex;
  ent: RefEntity;
  frames: number;
  light: number;
  lightcolor: Vec3;
  start: number;
  baseframe: number;
}

const zeroEntity = (): RefEntity => ({
  model: null, angles: [0, 0, 0], origin: [0, 0, 0], frame: 0, oldorigin: [0, 0, 0], oldframe: 0,
  backlerp: 0, skinnum: 0, lightstyle: 0, alpha: 0, skin: null, flags: 0,
});

const emptyExplosion = (): Explosion => ({
  type: Ex.free, ent: zeroEntity(), frames: 0, light: 0, lightcolor: [0, 0, 0], start: 0, baseframe: 0,
});

/** beam_t. */
interface Beam {
  entity: number;
  dest_entity: number;
  model: string | null;
  endtime: number;
  offset: Vec3;
  start: Vec3;
  end: Vec3;
}

const emptyBeam = (): Beam => ({ entity: 0, dest_entity: 0, model: null, endtime: 0, offset: [0, 0, 0], start: [0, 0, 0], end: [0, 0, 0] });

/** laser_t. */
interface Laser { ent: RefEntity; endtime: number }

/** What svc_temp_entity carried, as the engine's parser reads it. */
export interface TempEntityMessage {
  type: number;
  pos: Vec3;
  pos2: Vec3;
  dir: Vec3;
  cnt?: number;
  color?: number;
  ent?: number;
  srcEnt?: number;
  destEnt?: number;
}

const splashColor = [0x00, 0xe0, 0xb0, 0x50, 0xd0, 0xe0, 0xe8];
const bfgLightramp = [300, 400, 600, 300, 150, 75];
const bigTeleportColors = [2 * 8, 13 * 8, 21 * 8, 18 * 8];

const rogue = (what: string): never => {
  throw new Error(`${what} is the Rogue mission pack's (cl_newfx.c), which is not ported`);
};

/** A shorthand for the many inclusive ranges of muzzle flash numbers. */
const inRange = (n: number, from: number, to: number) => n >= from && n <= to;

export class ClientEffects {
  readonly dlights: CDLight[] = Array.from({ length: d.MAX_DLIGHTS }, emptyDlight);
  /** The active particle list, tail first: the head (the newest) is the last element. */
  active: CParticle[] = [];
  private readonly explosions: Explosion[] = Array.from({ length: MAX_EXPLOSIONS }, emptyExplosion);
  private readonly beams: Beam[] = Array.from({ length: MAX_BEAMS }, emptyBeam);
  private readonly lasers: Laser[] = Array.from({ length: MAX_LASERS }, () => ({ ent: zeroEntity(), endtime: 0 }));
  /** avelocities, a static that CL_ClearState leaves alone. */
  private readonly avelocities = new Array<number>(NUMVERTEXNORMALS * 3).fill(0);
  /**
   * PARTICLE_GRAVITY, 40 units a second squared (a tenth of the world's 800: particles drift). The
   * C's is a #define; here a lab can change it. The demo oracle runs it at 40.
   */
  gravity = PARTICLE_GRAVITY;
  /** CL_AddParticles' `time`, which keeps its value into the next particle when that one is instant. */
  private particleTime = 0;

  // cl_mod_* (CL_RegisterTEntModels)
  private modExplode: string | null = null;
  private modSmoke: string | null = null;
  private modFlash: string | null = null;
  private modParasiteSegment: string | null = null;
  private modGrappleCable: string | null = null;
  private modExplo4: string | null = null;
  private modBfgExplo: string | null = null;
  private modPowerscreen: string | null = null;
  private modExplo4Big: string | null = null;

  constructor(private readonly host: FxHost, private readonly r: Rand) {}

  /** CL_ClearEffects (particles, dlights) and CL_ClearTEnts. */
  clear(): void {
    this.active = [];
    for (let i = 0; i < d.MAX_DLIGHTS; i++) this.dlights[i] = emptyDlight();
    for (let i = 0; i < MAX_EXPLOSIONS; i++) this.explosions[i] = emptyExplosion();
    for (let i = 0; i < MAX_BEAMS; i++) this.beams[i] = emptyBeam();
    for (let i = 0; i < MAX_LASERS; i++) this.lasers[i] = { ent: zeroEntity(), endtime: 0 };
  }

  /** CL_RegisterTEntModels: the models the effects draw (null where the game data lacks one). */
  registerModels(register: (name: string) => string | null): void {
    this.modExplode = register('models/objects/explode/tris.md2');
    this.modSmoke = register('models/objects/smoke/tris.md2');
    this.modFlash = register('models/objects/flash/tris.md2');
    this.modParasiteSegment = register('models/monsters/parasite/segment/tris.md2');
    this.modGrappleCable = register('models/ctf/segment/tris.md2');
    register('models/monsters/parasite/tip/tris.md2');
    this.modExplo4 = register('models/objects/r_explode/tris.md2');
    this.modBfgExplo = register('sprites/s_bfg2.sp2');
    this.modPowerscreen = register('models/items/armor/effect/tris.md2');
    this.modExplo4Big = register('models/objects/r_explode2/tris.md2');
  }

  // ------------------------------------------------------------------ dynamic lights

  /** CL_AllocDlight: the light with this key, else one that has died, else the first. */
  allocDlight(key: number): CDLight {
    if (key) {
      for (let i = 0; i < d.MAX_DLIGHTS; i++) {
        if (this.dlights[i].key === key) return (this.dlights[i] = { ...emptyDlight(), key });
      }
    }
    for (let i = 0; i < d.MAX_DLIGHTS; i++) {
      if (this.dlights[i].die < this.host.time) return (this.dlights[i] = { ...emptyDlight(), key });
    }
    return (this.dlights[0] = { ...emptyDlight(), key });
  }

  /** CL_RunDLights. The C returns at the first light that has died, so the rest wait a frame. */
  runDlights(): void {
    for (const dl of this.dlights) {
      if (!dl.radius) continue;
      if (dl.die < this.host.time) {
        dl.radius = 0;
        return;
      }
      dl.radius = f(dl.radius - f(this.host.frametime * dl.decay));
      if (dl.radius < 0) dl.radius = 0;
    }
  }

  /** CL_AddDLights, as ref_gl sees it (vidref_val == VIDREF_GL: negative lights stay negative). */
  addDlights(): void {
    for (const dl of this.dlights) {
      if (!dl.radius) continue;
      this.host.addLight(dl.origin, dl.radius, dl.color[0], dl.color[1], dl.color[2]);
    }
  }

  private setColor(dl: CDLight, r: number, g: number, b: number): void {
    dl.color = [f(r), f(g), f(b)];
  }

  // ------------------------------------------------------------------ muzzle flashes

  /** CL_ParseMuzzleFlash: a player's weapon fired. */
  muzzleFlash(i: number, weaponByte: number): void {
    const { host, r } = this;
    if (i < 1 || i >= d.MAX_EDICTS) throw new Error('CL_ParseMuzzleFlash: bad entity');
    const silenced = weaponByte & t.MZ_SILENCED;
    const weapon = weaponByte & ~t.MZ_SILENCED;
    const pl = host.entity(i);

    const dl = this.allocDlight(i);
    const { forward: fv, right: rv } = angleVectors(pl.current.angles);
    dl.origin = vectorMA(vectorMA(pl.current.origin, 18, fv), 16, rv);
    dl.radius = silenced ? f(100 + (r.rand() & 31)) : f(200 + (r.rand() & 31));
    dl.minlight = 32;
    dl.die = f(host.time);

    const volume = silenced ? f(0.2) : 1;
    const sound = (name: string, chan = CHAN_WEAPON, ofs = 0, vol = volume) => host.startSound(null, i, chan, name, vol, ATTN_NORM, f(ofs));
    const machgf = () => `weapons/machgf${(r.rand() % 5) + 1}b.wav`;

    switch (weapon) {
      case t.MZ_BLASTER: this.setColor(dl, 1, 1, 0); sound('weapons/blastf1a.wav'); break;
      case t.MZ_BLUEHYPERBLASTER: this.setColor(dl, 0, 0, 1); sound('weapons/hyprbf1a.wav'); break;
      case t.MZ_HYPERBLASTER: this.setColor(dl, 1, 1, 0); sound('weapons/hyprbf1a.wav'); break;
      case t.MZ_MACHINEGUN: this.setColor(dl, 1, 1, 0); sound(machgf()); break;
      case t.MZ_SHOTGUN:
        this.setColor(dl, 1, 1, 0);
        sound('weapons/shotgf1b.wav');
        sound('weapons/shotgr1b.wav', CHAN_AUTO, 0.1);
        break;
      case t.MZ_SSHOTGUN: this.setColor(dl, 1, 1, 0); sound('weapons/sshotf1b.wav'); break;
      case t.MZ_CHAINGUN1:
        dl.radius = f(200 + (r.rand() & 31));
        this.setColor(dl, 1, 0.25, 0);
        sound(machgf());
        break;
      case t.MZ_CHAINGUN2:
        dl.radius = f(225 + (r.rand() & 31));
        this.setColor(dl, 1, 0.5, 0);
        dl.die = f(host.time + 0.1); // long delay
        sound(machgf());
        sound(machgf(), CHAN_WEAPON, 0.05);
        break;
      case t.MZ_CHAINGUN3:
        dl.radius = f(250 + (r.rand() & 31));
        this.setColor(dl, 1, 1, 0);
        dl.die = f(host.time + 0.1); // long delay
        sound(machgf());
        sound(machgf(), CHAN_WEAPON, 0.033);
        sound(machgf(), CHAN_WEAPON, 0.066);
        break;
      case t.MZ_RAILGUN: this.setColor(dl, 0.5, 0.5, 1.0); sound('weapons/railgf1a.wav'); break;
      case t.MZ_ROCKET:
        this.setColor(dl, 1, 0.5, 0.2);
        sound('weapons/rocklf1a.wav');
        sound('weapons/rocklr1b.wav', CHAN_AUTO, 0.1);
        break;
      case t.MZ_GRENADE:
        this.setColor(dl, 1, 0.5, 0);
        sound('weapons/grenlf1a.wav');
        sound('weapons/grenlr1b.wav', CHAN_AUTO, 0.1);
        break;
      case t.MZ_BFG: this.setColor(dl, 0, 1, 0); sound('weapons/bfg__f1y.wav'); break;
      case t.MZ_LOGIN:
      case t.MZ_LOGOUT:
      case t.MZ_RESPAWN:
        if (weapon === t.MZ_LOGIN) this.setColor(dl, 0, 1, 0);
        else if (weapon === t.MZ_LOGOUT) this.setColor(dl, 1, 0, 0);
        else this.setColor(dl, 1, 1, 0);
        dl.die = f(host.time + 1.0);
        sound('weapons/grenlf1a.wav', CHAN_WEAPON, 0, 1);
        this.logoutEffect(pl.current.origin, weapon);
        break;
      case t.MZ_PHALANX: this.setColor(dl, 1, 0.5, 0.5); sound('weapons/plasshot.wav'); break;
      case t.MZ_IONRIPPER: this.setColor(dl, 1, 0.5, 0.5); sound('weapons/rippfire.wav'); break;
      case t.MZ_ETF_RIFLE: this.setColor(dl, 0.9, 0.7, 0); sound('weapons/nail1.wav'); break;
      case t.MZ_SHOTGUN2: this.setColor(dl, 1, 1, 0); sound('weapons/shotg2.wav'); break;
      case t.MZ_HEATBEAM: this.setColor(dl, 1, 1, 0); dl.die = f(host.time + 100); break;
      case t.MZ_BLASTER2: this.setColor(dl, 0, 1, 0); sound('weapons/blastf1a.wav'); break;
      case t.MZ_TRACKER: this.setColor(dl, -1, -1, -1); sound('weapons/disint2.wav'); break;
      case t.MZ_NUKE1: this.setColor(dl, 1, 0, 0); dl.die = f(host.time + 100); break;
      case t.MZ_NUKE2: this.setColor(dl, 1, 1, 0); dl.die = f(host.time + 100); break;
      case t.MZ_NUKE4: this.setColor(dl, 0, 0, 1); dl.die = f(host.time + 100); break;
      case t.MZ_NUKE8: this.setColor(dl, 0, 1, 1); dl.die = f(host.time + 100); break;
    }
  }

  /** CL_ParseMuzzleFlash2: a monster's weapon fired, placed by monster_flash_offset. */
  muzzleFlash2(ent: number, flash: number): void {
    const { host, r } = this;
    if (ent < 1 || ent >= d.MAX_EDICTS) throw new Error('CL_ParseMuzzleFlash2: bad entity');
    const cur = host.entity(ent).current;
    const { forward, right } = angleVectors(cur.angles);
    const ofs = t.monsterFlashOffset[flash];
    const origin: Vec3 = [0, 0, 0];
    for (let i = 0; i < 3; i++) origin[i] = f(f(cur.origin[i] + f(forward[i] * ofs[0])) + f(right[i] * ofs[1]));
    origin[2] = f(origin[2] + ofs[2]);

    const dl = this.allocDlight(ent);
    dl.origin = [...origin];
    dl.radius = f(200 + (r.rand() & 31));
    dl.minlight = 32;
    dl.die = f(host.time);

    const sound = (name: string, attn = ATTN_NORM) => host.startSound(null, ent, CHAN_WEAPON, name, 1, attn, 0);
    const gunfire = (name: string | null, attn = ATTN_NORM) => {
      this.setColor(dl, 1, 1, 0);
      this.particleEffect(origin, [0, 0, 0], 0, 40);
      this.smokeAndFlash(origin);
      if (name) sound(name, attn);
    };
    const n = flash;

    if (inRange(n, t.MZ2_INFANTRY_MACHINEGUN_1, t.MZ2_INFANTRY_MACHINEGUN_13)) gunfire('infantry/infatck1.wav');
    else if (inRange(n, t.MZ2_SOLDIER_MACHINEGUN_1, t.MZ2_SOLDIER_MACHINEGUN_8)) gunfire('soldier/solatck3.wav');
    else if (inRange(n, t.MZ2_GUNNER_MACHINEGUN_1, t.MZ2_GUNNER_MACHINEGUN_8)) gunfire('gunner/gunatck2.wav');
    else if (n === t.MZ2_ACTOR_MACHINEGUN_1 || inRange(n, t.MZ2_SUPERTANK_MACHINEGUN_1, t.MZ2_SUPERTANK_MACHINEGUN_6)
      || n === t.MZ2_TURRET_MACHINEGUN) gunfire('infantry/infatck1.wav');
    else if (inRange(n, t.MZ2_BOSS2_MACHINEGUN_L1, t.MZ2_BOSS2_MACHINEGUN_L5)
      || n === t.MZ2_CARRIER_MACHINEGUN_L1 || n === t.MZ2_CARRIER_MACHINEGUN_L2) gunfire('infantry/infatck1.wav', ATTN_NONE);
    else if (inRange(n, t.MZ2_SOLDIER_BLASTER_1, t.MZ2_SOLDIER_BLASTER_8) || n === t.MZ2_TURRET_BLASTER) {
      this.setColor(dl, 1, 1, 0); sound('soldier/solatck2.wav');
    } else if (n === t.MZ2_FLYER_BLASTER_1 || n === t.MZ2_FLYER_BLASTER_2) {
      this.setColor(dl, 1, 1, 0); sound('flyer/flyatck3.wav');
    } else if (n === t.MZ2_MEDIC_BLASTER_1) {
      this.setColor(dl, 1, 1, 0); sound('medic/medatck1.wav');
    } else if (n === t.MZ2_HOVER_BLASTER_1) {
      this.setColor(dl, 1, 1, 0); sound('hover/hovatck1.wav');
    } else if (n === t.MZ2_FLOAT_BLASTER_1) {
      this.setColor(dl, 1, 1, 0); sound('floater/fltatck1.wav');
    } else if (inRange(n, t.MZ2_SOLDIER_SHOTGUN_1, t.MZ2_SOLDIER_SHOTGUN_8)) {
      this.setColor(dl, 1, 1, 0);
      this.smokeAndFlash(origin);
      sound('soldier/solatck1.wav');
    } else if (inRange(n, t.MZ2_TANK_BLASTER_1, t.MZ2_TANK_BLASTER_3)) {
      this.setColor(dl, 1, 1, 0); sound('tank/tnkatck3.wav');
    } else if (inRange(n, t.MZ2_TANK_MACHINEGUN_1, t.MZ2_TANK_MACHINEGUN_19)) {
      this.setColor(dl, 1, 1, 0);
      this.particleEffect(origin, [0, 0, 0], 0, 40);
      this.smokeAndFlash(origin);
      sound(`tank/tnkatk2${String.fromCharCode(97 + (r.rand() % 5))}.wav`);
    } else if (n === t.MZ2_CHICK_ROCKET_1 || n === t.MZ2_TURRET_ROCKET) {
      this.setColor(dl, 1, 0.5, 0.2); sound('chick/chkatck2.wav');
    } else if (inRange(n, t.MZ2_TANK_ROCKET_1, t.MZ2_TANK_ROCKET_3)) {
      this.setColor(dl, 1, 0.5, 0.2); sound('tank/tnkatck1.wav');
    } else if (inRange(n, t.MZ2_SUPERTANK_ROCKET_1, t.MZ2_SUPERTANK_ROCKET_3) || inRange(n, t.MZ2_BOSS2_ROCKET_1, t.MZ2_BOSS2_ROCKET_4)
      || n === t.MZ2_CARRIER_ROCKET_1) {
      this.setColor(dl, 1, 0.5, 0.2); sound('tank/rocket.wav');
    } else if (inRange(n, t.MZ2_GUNNER_GRENADE_1, t.MZ2_GUNNER_GRENADE_4)) {
      this.setColor(dl, 1, 0.5, 0); sound('gunner/gunatck3.wav');
    } else if (n === t.MZ2_GLADIATOR_RAILGUN_1 || n === t.MZ2_CARRIER_RAILGUN || n === t.MZ2_WIDOW_RAIL) {
      this.setColor(dl, 0.5, 0.5, 1.0);
    } else if (n === t.MZ2_MAKRON_BFG) {
      this.setColor(dl, 0.5, 1, 0.5);
    } else if (inRange(n, t.MZ2_MAKRON_BLASTER_1, t.MZ2_MAKRON_BLASTER_17)) {
      this.setColor(dl, 1, 1, 0); sound('makron/blaster.wav');
    } else if (inRange(n, t.MZ2_JORG_MACHINEGUN_L1, t.MZ2_JORG_MACHINEGUN_L6)) gunfire('boss3/xfire.wav');
    else if (inRange(n, t.MZ2_JORG_MACHINEGUN_R1, t.MZ2_JORG_MACHINEGUN_R6)) gunfire(null);
    else if (n === t.MZ2_JORG_BFG_1) {
      this.setColor(dl, 0.5, 1, 0.5);
    } else if (inRange(n, t.MZ2_BOSS2_MACHINEGUN_R1, t.MZ2_BOSS2_MACHINEGUN_R5)
      || n === t.MZ2_CARRIER_MACHINEGUN_R1 || n === t.MZ2_CARRIER_MACHINEGUN_R2) gunfire(null);
    else if (n === t.MZ2_STALKER_BLASTER || n === t.MZ2_DAEDALUS_BLASTER || n === t.MZ2_MEDIC_BLASTER_2
      || n === t.MZ2_WIDOW_BLASTER || inRange(n, t.MZ2_WIDOW_BLASTER_SWEEP1, t.MZ2_WIDOW_BLASTER_SWEEP9)
      || inRange(n, t.MZ2_WIDOW_BLASTER_100, t.MZ2_WIDOW_BLASTER_70L) || inRange(n, t.MZ2_WIDOW_RUN_1, t.MZ2_WIDOW_RUN_8)) {
      this.setColor(dl, 0, 1, 0); sound('tank/tnkatck3.wav');
    } else if (n === t.MZ2_WIDOW_DISRUPTOR) {
      this.setColor(dl, -1, -1, -1); sound('weapons/disint2.wav');
    } else if (n === t.MZ2_WIDOW_PLASMABEAM || inRange(n, t.MZ2_WIDOW2_BEAMER_1, t.MZ2_WIDOW2_BEAMER_5)
      || inRange(n, t.MZ2_WIDOW2_BEAM_SWEEP_1, t.MZ2_WIDOW2_BEAM_SWEEP_11)) {
      dl.radius = f(300 + (r.rand() & 100));
      this.setColor(dl, 1, 1, 0);
      dl.die = f(host.time + 200);
    }
  }

  // ------------------------------------------------------------------ particles

  /** Takes a particle off the free list onto the head of the active list, or null when none is free. */
  private alloc(): CParticle | null {
    if (this.active.length >= d.MAX_PARTICLES) return null;
    const p: CParticle = {
      time: f(this.host.time), org: [0, 0, 0], vel: [0, 0, 0], accel: [0, 0, 0], color: 0, colorvel: 0, alpha: 0, alphavel: 0,
    };
    this.active.push(p);
    return p;
  }

  /** CL_ParticleEffect: wall impact puffs. */
  particleEffect(org: Vec3, dir: Vec3, color: number, count: number): void {
    const { r } = this;
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      if (!p) return;
      p.color = f(color + (r.rand() & 7));
      const dd = f(r.rand() & 31);
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(f(org[j] + ((r.rand() & 7) - 4)) + f(dd * dir[j]));
        p.vel[j] = f(r.crand() * 20);
      }
      p.accel = [0, 0, -this.gravity];
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (0.5 + r.frand() * 0.3));
    }
  }

  /** CL_ParticleEffect2 (one colour) and CL_ParticleEffect3 (rising, the Reckoning's tunnel sparks). */
  particleEffect2(org: Vec3, dir: Vec3, color: number, count: number, rising = false): void {
    const { r } = this;
    for (let i = 0; i < count; i++) {
      const p = this.alloc();
      if (!p) return;
      p.color = f(color);
      const dd = f(r.rand() & 7);
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(f(org[j] + ((r.rand() & 7) - 4)) + f(dd * dir[j]));
        p.vel[j] = f(r.crand() * 20);
      }
      p.accel = [0, 0, rising ? this.gravity : -this.gravity];
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (0.5 + r.frand() * 0.3));
    }
  }

  /** CL_TeleporterParticles: EF_TELEPORTER, every frame the entity is in. */
  teleporterParticles(ent: EntityState): void {
    const { r } = this;
    for (let i = 0; i < 8; i++) {
      const p = this.alloc();
      if (!p) return;
      p.color = 0xdb;
      for (let j = 0; j < 2; j++) {
        p.org[j] = f(f(ent.origin[j] - 16) + (r.rand() & 31));
        p.vel[j] = f(r.crand() * 14);
      }
      p.org[2] = f(f(ent.origin[2] - 8) + (r.rand() & 7));
      p.vel[2] = f(80 + (r.rand() & 7));
      p.accel = [0, 0, -this.gravity];
      p.alpha = 1.0;
      p.alphavel = -0.5;
    }
  }

  /** CL_LogoutEffect: a player's login, logout or respawn. */
  logoutEffect(org: Vec3, type: number): void {
    const { r } = this;
    for (let i = 0; i < 500; i++) {
      const p = this.alloc();
      if (!p) return;
      if (type === t.MZ_LOGIN) p.color = f(0xd0 + (r.rand() & 7)); // green
      else if (type === t.MZ_LOGOUT) p.color = f(0x40 + (r.rand() & 7)); // red
      else p.color = f(0xe0 + (r.rand() & 7)); // yellow
      p.org[0] = f(f(org[0] - 16) + f(r.frand() * 32));
      p.org[1] = f(f(org[1] - 16) + f(r.frand() * 32));
      p.org[2] = f(f(org[2] - 24) + f(r.frand() * 56));
      for (let j = 0; j < 3; j++) p.vel[j] = f(r.crand() * 20);
      p.accel = [0, 0, -this.gravity];
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (1.0 + r.frand() * 0.3));
    }
  }

  /** CL_ItemRespawnParticles. */
  itemRespawnParticles(org: Vec3): void {
    const { r } = this;
    for (let i = 0; i < 64; i++) {
      const p = this.alloc();
      if (!p) return;
      p.color = f(0xd4 + (r.rand() & 3)); // green
      for (let j = 0; j < 3; j++) p.org[j] = f(org[j] + f(r.crand() * 8));
      for (let j = 0; j < 3; j++) p.vel[j] = f(r.crand() * 8);
      p.accel = [0, 0, f(-this.gravity * 0.2)];
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (1.0 + r.frand() * 0.3));
    }
  }

  /** CL_ExplosionParticles and CL_BFGExplosionParticles (base colour 0xd0). */
  explosionParticles(org: Vec3, base = 0xe0): void {
    const { r } = this;
    for (let i = 0; i < 256; i++) {
      const p = this.alloc();
      if (!p) return;
      p.color = f(base + (r.rand() & 7));
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(org[j] + ((r.rand() % 32) - 16));
        p.vel[j] = f((r.rand() % 384) - 192);
      }
      p.accel = [0, 0, -this.gravity];
      p.alpha = 1.0;
      p.alphavel = f(-0.8 / (0.5 + r.frand() * 0.3));
    }
  }

  /** CL_BigTeleportParticles: a boss teleporting to its station. */
  bigTeleportParticles(org: Vec3): void {
    const { r } = this;
    for (let i = 0; i < 4096; i++) {
      const p = this.alloc();
      if (!p) return;
      p.color = bigTeleportColors[r.rand() & 3];
      const angle = f(Math.PI * 2 * (r.rand() & 1023) / 1023.0);
      const dist = f(r.rand() & 31);
      // cos() and sin() are doubles, so these sums are too
      p.org[0] = f(org[0] + Math.cos(angle) * dist);
      p.vel[0] = f(Math.cos(angle) * (70 + (r.rand() & 63)));
      p.accel[0] = f(-Math.cos(angle) * 100);
      p.org[1] = f(org[1] + Math.sin(angle) * dist);
      p.vel[1] = f(Math.sin(angle) * (70 + (r.rand() & 63)));
      p.accel[1] = f(-Math.sin(angle) * 100);
      p.org[2] = f(f(org[2] + 8) + (r.rand() % 90));
      p.vel[2] = f(-100 + (r.rand() & 31));
      p.accel[2] = this.gravity * 4;
      p.alpha = 1.0;
      p.alphavel = f(-0.3 / (0.5 + r.frand() * 0.3));
    }
  }

  /** CL_BlasterParticles: a blaster bolt hitting a wall. */
  blasterParticles(org: Vec3, dir: Vec3): void {
    const { r } = this;
    for (let i = 0; i < 40; i++) {
      const p = this.alloc();
      if (!p) return;
      p.color = f(0xe0 + (r.rand() & 7));
      const dd = f(r.rand() & 15);
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(f(org[j] + ((r.rand() & 7) - 4)) + f(dd * dir[j]));
        p.vel[j] = f(f(dir[j] * 30) + f(r.crand() * 40));
      }
      p.accel = [0, 0, -this.gravity];
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (0.5 + r.frand() * 0.3));
    }
  }

  /** The start of every trail: the unit vector from start to end, scaled by the step, and the length. */
  private trail(start: Vec3, end: Vec3, step: number): { move: Vec3; vec: Vec3; len: number } {
    const vec = vectorSubtract(end, start);
    const len = vectorNormalize(vec);
    return { move: [...start], vec: vectorScale(vec, step), len };
  }

  private step(move: Vec3, vec: Vec3): void {
    for (let j = 0; j < 3; j++) move[j] = f(move[j] + vec[j]);
  }

  /** CL_BlasterTrail (and the Reckoning's plasma). */
  blasterTrail(start: Vec3, end: Vec3): void {
    const { r } = this;
    const { move, vec } = this.trail(start, end, 5);
    let { len } = this.trail(start, end, 5);
    while (len > 0) {
      len = f(len - 5);
      const p = this.alloc();
      if (!p) return;
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (0.3 + r.frand() * 0.2));
      p.color = 0xe0;
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(move[j] + r.crand());
        p.vel[j] = f(r.crand() * 5);
        p.accel[j] = 0;
      }
      this.step(move, vec);
    }
  }

  /** CL_FlagTrail: a carried CTF flag. */
  flagTrail(start: Vec3, end: Vec3, color: number): void {
    const { r } = this;
    const { move, vec } = this.trail(start, end, 5);
    let { len } = this.trail(start, end, 5);
    while (len > 0) {
      len = f(len - 5);
      const p = this.alloc();
      if (!p) return;
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (0.8 + r.frand() * 0.2));
      p.color = f(color);
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(move[j] + f(r.crand() * 16));
        p.vel[j] = f(r.crand() * 5);
        p.accel[j] = 0;
      }
      this.step(move, vec);
    }
  }

  /** CL_DiminishingTrail: gibs bleed, grenades and rockets smoke; fewer particles the longer it flies. */
  diminishingTrail(start: Vec3, end: Vec3, old: FxEntity, flags: number): void {
    const { r } = this;
    const { move, vec } = this.trail(start, end, 0.5);
    let { len } = this.trail(start, end, 0.5);
    let orgscale: number;
    let velscale: number;
    if (old.trailcount > 900) { orgscale = 4; velscale = 15; }
    else if (old.trailcount > 800) { orgscale = 2; velscale = 10; }
    else { orgscale = 1; velscale = 5; }

    while (len > 0) {
      len = f(len - 0.5);
      if (this.active.length >= d.MAX_PARTICLES) return;
      // drop less particles as it flies
      if ((r.rand() & 1023) < old.trailcount) {
        const p = this.alloc()!;
        if (flags & d.EF_GIB) {
          p.alpha = 1.0;
          p.alphavel = f(-1.0 / (1 + r.frand() * 0.4));
          p.color = f(0xe8 + (r.rand() & 7));
          for (let j = 0; j < 3; j++) {
            p.org[j] = f(move[j] + f(r.crand() * orgscale));
            p.vel[j] = f(r.crand() * velscale);
            p.accel[j] = 0;
          }
          p.vel[2] = f(p.vel[2] - this.gravity);
        } else if (flags & d.EF_GREENGIB) {
          p.alpha = 1.0;
          p.alphavel = f(-1.0 / (1 + r.frand() * 0.4));
          p.color = f(0xdb + (r.rand() & 7));
          for (let j = 0; j < 3; j++) {
            p.org[j] = f(move[j] + f(r.crand() * orgscale));
            p.vel[j] = f(r.crand() * velscale);
            p.accel[j] = 0;
          }
          p.vel[2] = f(p.vel[2] - this.gravity);
        } else {
          p.alpha = 1.0;
          p.alphavel = f(-1.0 / (1 + r.frand() * 0.2));
          p.color = f(4 + (r.rand() & 7));
          for (let j = 0; j < 3; j++) {
            p.org[j] = f(move[j] + f(r.crand() * orgscale));
            p.vel[j] = f(r.crand() * velscale);
          }
          p.accel[2] = 20;
        }
      }
      old.trailcount -= 5;
      if (old.trailcount < 100) old.trailcount = 100;
      this.step(move, vec);
    }
  }

  /** CL_RocketTrail: the diminishing smoke, then the fire. */
  rocketTrail(start: Vec3, end: Vec3, old: FxEntity): void {
    const { r } = this;
    this.diminishingTrail(start, end, old, d.EF_ROCKET);
    const { move, vec } = this.trail(start, end, 1);
    let { len } = this.trail(start, end, 1);
    while (len > 0) {
      len = f(len - 1);
      if (this.active.length >= d.MAX_PARTICLES) return;
      if ((r.rand() & 7) === 0) {
        const p = this.alloc()!;
        p.alpha = 1.0;
        p.alphavel = f(-1.0 / (1 + r.frand() * 0.2));
        p.color = f(0xdc + (r.rand() & 3));
        for (let j = 0; j < 3; j++) {
          p.org[j] = f(move[j] + f(r.crand() * 5));
          p.vel[j] = f(r.crand() * 20);
        }
        p.accel[2] = -this.gravity;
      }
      this.step(move, vec);
    }
  }

  /** CL_RailTrail: a spiral round the line, then a core of grey dots. */
  railTrail(start: Vec3, end: Vec3): void {
    const { r } = this;
    let move: Vec3 = [...start];
    const vec = vectorSubtract(end, start);
    let len = vectorNormalize(vec);
    const { right, up } = makeNormalVectors(vec);

    for (let i = 0; i < len; i++) {
      const p = this.alloc();
      if (!p) return;
      const dd = f(i * 0.1);
      const c = f(Math.cos(dd));
      const s = f(Math.sin(dd));
      const dir = vectorMA(vectorScale(right, c), s, up);
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (1 + r.frand() * 0.2));
      p.color = f(0x74 + (r.rand() & 7));
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(move[j] + f(dir[j] * 3));
        p.vel[j] = f(dir[j] * 6);
      }
      this.step(move, vec);
    }

    const dec = 0.75;
    const vec2 = vectorScale(vec, dec);
    move = [...start];
    while (len > 0) {
      len = f(len - dec);
      const p = this.alloc();
      if (!p) return;
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (0.6 + r.frand() * 0.2));
      p.color = f((0x0 + r.rand()) & 15);
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(move[j] + f(r.crand() * 3));
        p.vel[j] = f(r.crand() * 3);
        p.accel[j] = 0;
      }
      this.step(move, vec2);
    }
  }

  /** CL_IonripperTrail (the Reckoning). */
  ionripperTrail(start: Vec3, end: Vec3): void {
    const { r } = this;
    const { move, vec } = this.trail(start, end, 5);
    let { len } = this.trail(start, end, 5);
    let left = 0;
    while (len > 0) {
      len = f(len - 5);
      const p = this.alloc();
      if (!p) return;
      p.alpha = 0.5;
      p.alphavel = f(-1.0 / (0.3 + r.frand() * 0.2));
      p.color = f(0xe4 + (r.rand() & 3));
      for (let j = 0; j < 3; j++) {
        p.org[j] = move[j];
        p.accel[j] = 0;
      }
      if (left) { left = 0; p.vel[0] = 10; } else { left = 1; p.vel[0] = -10; }
      p.vel[1] = 0;
      p.vel[2] = 0;
      this.step(move, vec);
    }
  }

  /** CL_BubbleTrail: a bullet through water. */
  bubbleTrail(start: Vec3, end: Vec3): void {
    const { r } = this;
    const dec = 32;
    const { move, vec, len } = this.trail(start, end, dec);
    // i is an int: i += dec converts back to one
    for (let i = 0; i < len; i = Math.trunc(i + dec)) {
      const p = this.alloc();
      if (!p) return;
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (1 + r.frand() * 0.2));
      p.color = f(4 + (r.rand() & 7));
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(move[j] + f(r.crand() * 2));
        p.vel[j] = f(r.crand() * 5);
      }
      p.vel[2] = f(p.vel[2] + 6);
      this.step(move, vec);
    }
  }

  /** avelocities: filled the first time, and again whenever its first value came out 0. */
  private ensureAvelocities(): void {
    if (this.avelocities[0]) return;
    for (let i = 0; i < NUMVERTEXNORMALS * 3; i++) this.avelocities[i] = f((this.r.rand() & 255) * 0.01);
  }

  /** The forward vector of a particle's tumbling angles at ltime. */
  private tumble(ltime: number, i: number): Vec3 {
    const av = this.avelocities;
    let angle = f(ltime * av[i * 3]);
    const sy = f(Math.sin(angle));
    const cy = f(Math.cos(angle));
    angle = f(ltime * av[i * 3 + 1]);
    const sp = f(Math.sin(angle));
    const cp = f(Math.cos(angle));
    return [f(cp * cy), f(cp * sy), -sp];
  }

  /** CL_FlyParticles: the flies round a corpse. */
  flyParticles(origin: Vec3, count: number): void {
    if (count > NUMVERTEXNORMALS) count = NUMVERTEXNORMALS;
    this.ensureAvelocities();
    const ltime = f(this.host.time / 1000.0);
    for (let i = 0; i < count; i += 2) {
      const forward = this.tumble(ltime, i);
      const p = this.alloc();
      if (!p) return;
      const dist = f(Math.sin(f(ltime + i)) * 64);
      for (let j = 0; j < 3; j++) p.org[j] = f(f(origin[j] + f(bytedirs[i][j] * dist)) + f(forward[j] * BEAMLENGTH));
      p.color = 0;
      p.colorvel = 0;
      p.alpha = 1;
      p.alphavel = -100;
    }
  }

  /** CL_FlyEffect: the swarm grows for 20 seconds, holds, and thins out over the last 20 of each minute. */
  flyEffect(ent: FxEntity, origin: Vec3): void {
    const time = this.host.time;
    let starttime: number;
    if (ent.fly_stoptime < time) {
      starttime = time;
      ent.fly_stoptime = time + 60000;
    } else {
      starttime = ent.fly_stoptime - 60000;
    }
    let n = time - starttime;
    let count: number;
    if (n < 20000) count = Math.trunc(n * 162 / 20000.0);
    else {
      n = ent.fly_stoptime - time;
      count = n < 20000 ? Math.trunc(n * 162 / 20000.0) : 162;
    }
    this.flyParticles(origin, count);
  }

  /** CL_BfgParticles: the ball of a BFG shot. */
  bfgParticles(ent: RefEntity): void {
    this.ensureAvelocities();
    const ltime = f(this.host.time / 1000.0);
    for (let i = 0; i < NUMVERTEXNORMALS; i++) {
      const forward = this.tumble(ltime, i);
      const p = this.alloc();
      if (!p) return;
      let dist = f(Math.sin(f(ltime + i)) * 64);
      for (let j = 0; j < 3; j++) p.org[j] = f(f(ent.origin[j] + f(bytedirs[i][j] * dist)) + f(forward[j] * BEAMLENGTH));
      dist = f(vectorLength(vectorSubtract(p.org, ent.origin)) / 90.0);
      p.color = f(Math.floor(f(0xd0 + f(dist * 7))));
      p.colorvel = 0;
      p.alpha = f(1.0 - dist);
      p.alphavel = -100;
    }
  }

  /**
   * CL_TrapParticles (the Reckoning's trap). `(rand()&23) * crand()` draws twice in one expression,
   * which C leaves unordered; this draws left to right.
   */
  trapParticles(ent: RefEntity): void {
    const { r } = this;
    ent.origin[2] = f(ent.origin[2] - 14);
    const start: Vec3 = [...ent.origin];
    const end: Vec3 = [ent.origin[0], ent.origin[1], f(ent.origin[2] + 64)];
    const { move, vec } = this.trail(start, end, 5);
    let { len } = this.trail(start, end, 5);
    while (len > 0) {
      len = f(len - 5);
      const p = this.alloc();
      if (!p) return;
      p.alpha = 1.0;
      p.alphavel = f(-1.0 / (0.3 + r.frand() * 0.2));
      p.color = 0xe0;
      for (let j = 0; j < 3; j++) {
        p.org[j] = f(move[j] + r.crand());
        p.vel[j] = f(r.crand() * 15);
        p.accel[j] = 0;
      }
      p.accel[2] = this.gravity;
      this.step(move, vec);
    }

    ent.origin[2] = f(ent.origin[2] + 14);
    const org: Vec3 = [...ent.origin];
    for (let i = -2; i <= 2; i += 4) {
      for (let j = -2; j <= 2; j += 4) {
        for (let k = -2; k <= 4; k += 4) {
          const p = this.alloc();
          if (!p) return;
          p.color = f(0xe0 + (r.rand() & 3));
          p.alpha = 1.0;
          p.alphavel = f(-1.0 / (0.3 + (r.rand() & 7) * 0.02));
          for (const [a, o] of [[0, i], [1, j], [2, k]]) {
            const n = r.rand() & 23;
            p.org[a] = f(f(org[a] + o) + f(n * r.crand()));
          }
          const dir: Vec3 = [j * 8, i * 8, k * 8];
          vectorNormalize(dir);
          const vel = (50 + r.rand()) & 63;
          p.vel = vectorScale(dir, vel);
          p.accel = [0, 0, -this.gravity];
        }
      }
    }
  }

  /** CL_TeleportParticles: a player teleporting. */
  teleportParticles(org: Vec3): void {
    const { r } = this;
    for (let i = -16; i <= 16; i += 4) {
      for (let j = -16; j <= 16; j += 4) {
        for (let k = -16; k <= 32; k += 4) {
          const p = this.alloc();
          if (!p) return;
          p.color = f(7 + (r.rand() & 7));
          p.alpha = 1.0;
          p.alphavel = f(-1.0 / (0.3 + (r.rand() & 7) * 0.02));
          p.org[0] = f(f(org[0] + i) + (r.rand() & 3));
          p.org[1] = f(f(org[1] + j) + (r.rand() & 3));
          p.org[2] = f(f(org[2] + k) + (r.rand() & 3));
          const dir: Vec3 = [j * 8, i * 8, k * 8];
          vectorNormalize(dir);
          const vel = f(50 + (r.rand() & 63));
          p.vel = vectorScale(dir, vel);
          p.accel = [0, 0, -this.gravity];
        }
      }
    }
  }

  /** CL_AddParticles: moves each particle along its parabola, drops the faded ones, draws the rest. */
  addParticles(): void {
    const time0 = this.host.time;
    const kept: CParticle[] = [];
    for (let k = this.active.length - 1; k >= 0; k--) {
      const p = this.active[k];
      let alpha: number;
      if (p.alphavel !== INSTANT_PARTICLE) {
        this.particleTime = f(f(time0 - p.time) * 0.001);
        alpha = f(p.alpha + f(this.particleTime * p.alphavel));
        if (alpha <= 0) continue; // faded out
      } else {
        alpha = p.alpha;
      }
      kept.push(p);
      if (alpha > 1.0) alpha = 1;
      const color = Math.trunc(p.color);
      const time = this.particleTime;
      const time2 = f(time * time);
      const org: Vec3 = [0, 0, 0];
      for (let j = 0; j < 3; j++) org[j] = f(f(p.org[j] + f(p.vel[j] * time)) + f(p.accel[j] * time2));
      this.host.addParticle(org, color, alpha);
      if (p.alphavel === INSTANT_PARTICLE) {
        p.alphavel = 0.0;
        p.alpha = 0.0;
      }
    }
    this.active = kept.reverse();
  }

  /** CL_EntityEvent: an entity has just been parsed with an event. */
  entityEvent(ent: EntityState): void {
    const { host } = this;
    switch (ent.event) {
      case d.EV_ITEM_RESPAWN:
        host.startSound(null, ent.number, CHAN_WEAPON, 'items/respawn1.wav', 1, ATTN_IDLE, 0);
        this.itemRespawnParticles(ent.origin);
        break;
      case d.EV_PLAYER_TELEPORT:
        host.startSound(null, ent.number, CHAN_WEAPON, 'misc/tele1.wav', 1, ATTN_IDLE, 0);
        this.teleportParticles(ent.origin);
        break;
      case d.EV_FOOTSTEP:
        if (host.footsteps) host.startSound(null, ent.number, CHAN_BODY, `player/step${(this.r.rand() & 3) + 1}.wav`, 1, ATTN_NORM, 0);
        break;
      case d.EV_FALLSHORT:
        host.startSound(null, ent.number, CHAN_AUTO, 'player/land1.wav', 1, ATTN_NORM, 0);
        break;
      case d.EV_FALL:
        host.startSound(null, ent.number, CHAN_AUTO, '*fall2.wav', 1, ATTN_NORM, 0);
        break;
      case d.EV_FALLFAR:
        host.startSound(null, ent.number, CHAN_AUTO, '*fall1.wav', 1, ATTN_NORM, 0);
        break;
    }
  }

  /** The trails, lights and extra models CL_AddPacketEntities adds for an entity's effects. */
  entityEffects(cent: FxEntity, s1: EntityState, effects: number, ent: RefEntity): void {
    const { host } = this;
    if (effects & d.EF_POWERSCREEN) {
      ent.model = this.modPowerscreen;
      ent.oldframe = 0;
      ent.frame = 0;
      ent.flags |= d.RF_TRANSLUCENT | d.RF_SHELL_GREEN;
      ent.alpha = f(0.30);
      host.addEntity(ent);
    }
    // add automatic particle trails
    if (!(effects & ~d.EF_ROTATE)) return;
    const light = (i: number, r: number, g: number, b: number) => host.addLight(ent.origin, i, f(r), f(g), f(b));
    if (effects & d.EF_ROCKET) {
      this.rocketTrail(cent.lerp_origin, ent.origin, cent);
      light(200, 1, 1, 0);
    } else if (effects & d.EF_BLASTER) {
      // EF_BLASTER | EF_TRACKER is the Rogue blaster's
      if (effects & d.EF_TRACKER) rogue('CL_BlasterTrail2');
      this.blasterTrail(cent.lerp_origin, ent.origin);
      light(200, 1, 1, 0);
    } else if (effects & d.EF_HYPERBLASTER) {
      if (effects & d.EF_TRACKER) light(200, 0, 1, 0);
      else light(200, 1, 1, 0);
    } else if (effects & d.EF_GIB) {
      this.diminishingTrail(cent.lerp_origin, ent.origin, cent, effects);
    } else if (effects & d.EF_GRENADE) {
      this.diminishingTrail(cent.lerp_origin, ent.origin, cent, effects);
    } else if (effects & d.EF_FLIES) {
      this.flyEffect(cent, ent.origin);
    } else if (effects & d.EF_BFG) {
      let i: number;
      if (effects & d.EF_ANIM_ALLFAST) {
        this.bfgParticles(ent);
        i = 200;
      } else {
        i = bfgLightramp[s1.frame];
      }
      light(i, 0, 1, 0);
    } else if (effects & d.EF_TRAP) {
      ent.origin[2] = f(ent.origin[2] + 32);
      this.trapParticles(ent);
      const i = (this.r.rand() % 100) + 100;
      light(i, 1, 0.8, 0.1);
    } else if (effects & d.EF_FLAG1) {
      this.flagTrail(cent.lerp_origin, ent.origin, 242);
      light(225, 1, 0.1, 0.1);
    } else if (effects & d.EF_FLAG2) {
      this.flagTrail(cent.lerp_origin, ent.origin, 115);
      light(225, 0.1, 0.1, 1);
    } else if (effects & d.EF_TAGTRAIL) {
      rogue('CL_TagTrail');
    } else if (effects & d.EF_TRACKERTRAIL) {
      if (effects & d.EF_TRACKER) {
        // 50 + (500 * (sin(cl.time/500.0) + 1.0)), in doubles, into a float
        const intensity = f(50 + 500 * (Math.sin(host.time / 500.0) + 1.0));
        light(intensity, -1.0, -1.0, -1.0);
      } else {
        rogue('CL_Tracker_Shell');
      }
    } else if (effects & d.EF_TRACKER) {
      rogue('CL_TrackerTrail');
    } else if (effects & d.EF_GREENGIB) {
      this.diminishingTrail(cent.lerp_origin, ent.origin, cent, effects);
    } else if (effects & d.EF_IONRIPPER) {
      this.ionripperTrail(cent.lerp_origin, ent.origin);
      light(100, 1, 0.5, 0.5);
    } else if (effects & d.EF_BLUEHYPERBLASTER) {
      light(200, 0, 0, 1);
    } else if (effects & d.EF_PLASMA) {
      if (effects & d.EF_ANIM_ALLFAST) this.blasterTrail(cent.lerp_origin, ent.origin);
      light(130, 1, 0.5, 0.5);
    }
  }

  // ------------------------------------------------------------------ temporary entities (cl_tent.c)

  /** CL_AllocExplosion: a free slot, else the oldest. */
  private allocExplosion(): Explosion {
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      if (this.explosions[i].type === Ex.free) return (this.explosions[i] = emptyExplosion());
    }
    // find the oldest explosion (time is an int: the float start is cut to one)
    let time = this.host.time;
    let index = 0;
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      if (this.explosions[i].start < time) {
        time = Math.trunc(this.explosions[i].start);
        index = i;
      }
    }
    return (this.explosions[index] = emptyExplosion());
  }

  /** CL_SmokeAndFlash: the puff and flash at a bullet's hit or a monster's gun. */
  smokeAndFlash(origin: Vec3): void {
    let ex = this.allocExplosion();
    ex.ent.origin = [...origin];
    ex.type = Ex.misc;
    ex.frames = 4;
    ex.ent.flags = d.RF_TRANSLUCENT;
    ex.start = f(this.host.servertime - 100);
    ex.ent.model = this.modSmoke;

    ex = this.allocExplosion();
    ex.ent.origin = [...origin];
    ex.type = Ex.flash;
    ex.ent.flags = d.RF_FULLBRIGHT;
    ex.frames = 2;
    ex.start = f(this.host.servertime - 100);
    ex.ent.model = this.modFlash;
  }

  /** CL_ParseBeam and CL_ParseBeam2: a beam from an entity, replacing that entity's last. */
  private parseBeam(model: string | null, ent: number, start: Vec3, end: Vec3, offset: Vec3): number {
    const time = this.host.time;
    const set = (b: Beam) => {
      b.entity = ent;
      b.model = model;
      b.endtime = time + 200;
      b.start = [...start];
      b.end = [...end];
      b.offset = [...offset];
    };
    for (const b of this.beams) if (b.entity === ent) { set(b); return ent; }
    for (const b of this.beams) if (!b.model || b.endtime < time) { set(b); return ent; }
    return ent; // beam list overflow
  }

  /** CL_ParseLaser: a BFG laser, one of four colours drawn at random. */
  private parseLaser(start: Vec3, end: Vec3, colors: number): void {
    for (const l of this.lasers) {
      if (l.endtime < this.host.time) {
        l.ent.flags = d.RF_TRANSLUCENT | d.RF_BEAM;
        l.ent.origin = [...start];
        l.ent.oldorigin = [...end];
        l.ent.alpha = f(0.30);
        l.ent.skinnum = (colors >>> ((this.r.rand() % 4) * 8)) & 0xff;
        l.ent.model = null;
        l.ent.frame = 4;
        l.endtime = this.host.time + 100;
        return;
      }
    }
  }

  /** The angles that point an explosion model along a wall's normal (TE_BLASTER). */
  private static normalAngles(ent: RefEntity, dir: Vec3): void {
    ent.angles[0] = f(Math.acos(dir[2]) / Math.PI * 180);
    if (dir[0]) ent.angles[1] = f(Math.atan2(dir[1], dir[0]) / Math.PI * 180);
    else if (dir[1] > 0) ent.angles[1] = 90;
    else if (dir[1] < 0) ent.angles[1] = 270;
    else ent.angles[1] = 0;
  }

  /** CL_ParseTEnt. */
  tempEntity(m: TempEntityMessage): void {
    const { host, r } = this;
    const { type, pos, pos2, dir } = m;
    const sound = (org: Vec3 | null, name: string, attn = ATTN_NORM) => host.startSound(org, 0, 0, name, 1, attn, 0);
    let ex: Explosion;
    switch (type) {
      case t.TE_BLOOD: // bullet hitting flesh
        this.particleEffect(pos, dir, 0xe8, 60);
        break;

      case t.TE_GUNSHOT: // bullet hitting wall
      case t.TE_SPARKS:
      case t.TE_BULLET_SPARKS: {
        if (type === t.TE_GUNSHOT) this.particleEffect(pos, dir, 0, 40);
        else this.particleEffect(pos, dir, 0xe0, 6);
        if (type !== t.TE_SPARKS) {
          this.smokeAndFlash(pos);
          // impact sound
          const cnt = r.rand() & 15;
          if (cnt === 1) sound(pos, 'world/ric1.wav');
          else if (cnt === 2) sound(pos, 'world/ric2.wav');
          else if (cnt === 3) sound(pos, 'world/ric3.wav');
        }
        break;
      }

      case t.TE_SCREEN_SPARKS:
      case t.TE_SHIELD_SPARKS:
        this.particleEffect(pos, dir, type === t.TE_SCREEN_SPARKS ? 0xd0 : 0xb0, 40);
        sound(pos, 'weapons/lashit.wav');
        break;

      case t.TE_SHOTGUN: // bullet hitting wall
        this.particleEffect(pos, dir, 0, 20);
        this.smokeAndFlash(pos);
        break;

      case t.TE_SPLASH: { // bullet hitting water
        const rr = m.color ?? 0;
        const color = rr > 6 ? 0x00 : splashColor[rr];
        this.particleEffect(pos, dir, color, m.cnt ?? 0);
        if (rr === t.SPLASH_SPARKS) {
          const s = r.rand() & 3;
          sound(pos, s === 0 ? 'world/spark5.wav' : s === 1 ? 'world/spark6.wav' : 'world/spark7.wav', ATTN_STATIC);
        }
        break;
      }

      case t.TE_LASER_SPARKS:
        this.particleEffect2(pos, dir, m.color ?? 0, m.cnt ?? 0);
        break;

      case t.TE_BLUEHYPERBLASTER:
        // 3.21 reads the second vector as a position, and uses it as the direction
        this.blasterParticles(pos, pos2);
        break;

      case t.TE_BLASTER: // blaster hitting wall
        this.blasterParticles(pos, dir);
        ex = this.allocExplosion();
        ex.ent.origin = [...pos];
        ClientEffects.normalAngles(ex.ent, dir);
        ex.type = Ex.misc;
        ex.ent.flags = d.RF_FULLBRIGHT | d.RF_TRANSLUCENT;
        ex.start = f(host.servertime - 100);
        ex.light = 150;
        ex.lightcolor[0] = 1;
        ex.lightcolor[1] = 1;
        ex.ent.model = this.modExplode;
        ex.frames = 4;
        sound(pos, 'weapons/lashit.wav');
        break;

      case t.TE_RAILTRAIL: // railgun effect
        this.railTrail(pos, pos2);
        sound(pos2, 'weapons/railgf1a.wav');
        break;

      case t.TE_EXPLOSION2:
      case t.TE_GRENADE_EXPLOSION:
      case t.TE_GRENADE_EXPLOSION_WATER:
        ex = this.allocExplosion();
        ex.ent.origin = [...pos];
        ex.type = Ex.poly;
        ex.ent.flags = d.RF_FULLBRIGHT;
        ex.start = f(host.servertime - 100);
        ex.light = 350;
        ex.lightcolor = [1.0, 0.5, 0.5];
        ex.ent.model = this.modExplo4;
        ex.frames = 19;
        ex.baseframe = 30;
        ex.ent.angles[1] = r.rand() % 360;
        this.explosionParticles(pos);
        sound(pos, type === t.TE_GRENADE_EXPLOSION_WATER ? 'weapons/xpld_wat.wav' : 'weapons/grenlx1a.wav');
        break;

      case t.TE_PLASMA_EXPLOSION:
      case t.TE_EXPLOSION1:
      case t.TE_EXPLOSION1_BIG:
      case t.TE_ROCKET_EXPLOSION:
      case t.TE_ROCKET_EXPLOSION_WATER:
      case t.TE_EXPLOSION1_NP:
      case t.TE_PLAIN_EXPLOSION:
        ex = this.allocExplosion();
        ex.ent.origin = [...pos];
        ex.type = Ex.poly;
        ex.ent.flags = d.RF_FULLBRIGHT;
        ex.start = f(host.servertime - 100);
        ex.light = 350;
        ex.lightcolor = [1.0, 0.5, 0.5];
        ex.ent.angles[1] = r.rand() % 360;
        ex.ent.model = type === t.TE_EXPLOSION1_BIG ? this.modExplo4Big : this.modExplo4;
        if (r.frand() < 0.5) ex.baseframe = 15;
        ex.frames = 15;
        if (type !== t.TE_EXPLOSION1_BIG && type !== t.TE_EXPLOSION1_NP && type !== t.TE_PLAIN_EXPLOSION) this.explosionParticles(pos);
        if (type === t.TE_PLASMA_EXPLOSION) sound(pos, 'weapons/rocklx1a.wav');
        else sound(pos, type === t.TE_ROCKET_EXPLOSION_WATER ? 'weapons/xpld_wat.wav' : 'weapons/rocklx1a.wav');
        break;

      case t.TE_BFG_EXPLOSION:
        ex = this.allocExplosion();
        ex.ent.origin = [...pos];
        ex.type = Ex.poly;
        ex.ent.flags = d.RF_FULLBRIGHT;
        ex.start = f(host.servertime - 100);
        ex.light = 350;
        ex.lightcolor = [0.0, 1.0, 0.0];
        ex.ent.model = this.modBfgExplo;
        ex.ent.flags |= d.RF_TRANSLUCENT;
        ex.ent.alpha = f(0.30);
        ex.frames = 4;
        break;

      case t.TE_BFG_BIGEXPLOSION:
        this.explosionParticles(pos, 0xd0);
        break;

      case t.TE_BFG_LASER:
        this.parseLaser(pos, pos2, 0xd0d1d2d3);
        break;

      case t.TE_BUBBLETRAIL:
        this.bubbleTrail(pos, pos2);
        break;

      case t.TE_PARASITE_ATTACK:
      case t.TE_MEDIC_CABLE_ATTACK:
        this.parseBeam(this.modParasiteSegment, m.ent ?? 0, pos, pos2, [0, 0, 0]);
        break;

      case t.TE_BOSSTPORT: // boss teleporting to station
        this.bigTeleportParticles(pos);
        sound(pos, 'misc/bigtele.wav', ATTN_NONE);
        break;

      case t.TE_GRAPPLE_CABLE:
        this.parseBeam(this.modGrappleCable, m.ent ?? 0, pos, pos2, dir);
        break;

      case t.TE_WELDING_SPARKS:
        this.particleEffect2(pos, dir, m.color ?? 0, m.cnt ?? 0);
        ex = this.allocExplosion();
        ex.ent.origin = [...pos];
        ex.type = Ex.flash;
        // note to self: we need a better no draw flag
        ex.ent.flags = d.RF_BEAM;
        ex.start = f(host.servertime - 0.1);
        ex.light = f(100 + (r.rand() % 75));
        ex.lightcolor = [1.0, 1.0, f(0.3)];
        ex.ent.model = this.modFlash;
        ex.frames = 2;
        break;

      case t.TE_GREENBLOOD:
        this.particleEffect2(pos, dir, 0xdf, 30);
        break;

      case t.TE_TUNNEL_SPARKS:
        this.particleEffect2(pos, dir, m.color ?? 0, m.cnt ?? 0, true);
        break;

      case t.TE_MOREBLOOD:
        this.particleEffect(pos, dir, 0xe8, 250);
        break;

      case t.TE_ELECTRIC_SPARKS:
        this.particleEffect(pos, dir, 0x75, 40);
        sound(pos, 'weapons/lashit.wav');
        break;

      case t.TE_TELEPORT_EFFECT:
      case t.TE_DBALL_GOAL:
        this.teleportParticles(pos);
        break;

      case t.TE_BLASTER2: case t.TE_FLECHETTE: case t.TE_LIGHTNING: case t.TE_DEBUGTRAIL: case t.TE_FLASHLIGHT:
      case t.TE_FORCEWALL: case t.TE_HEATBEAM: case t.TE_MONSTER_HEATBEAM: case t.TE_HEATBEAM_SPARKS:
      case t.TE_HEATBEAM_STEAM: case t.TE_STEAM: case t.TE_BUBBLETRAIL2: case t.TE_CHAINFIST_SMOKE:
      case t.TE_TRACKER_EXPLOSION: case t.TE_WIDOWBEAMOUT: case t.TE_NUKEBLAST: case t.TE_WIDOWSPLASH:
        rogue(`temp entity ${type}`);
        break;

      default:
        throw new Error('CL_ParseTEnt: bad type');
    }
  }

  /** CL_AddBeams: each beam as a row of models from its start to its end. */
  private addBeams(): void {
    const { host, r } = this;
    for (const b of this.beams) {
      if (!b.model || b.endtime < host.time) continue;
      // if coming from the player, update the start position
      if (b.entity === host.playernum + 1) {
        b.start = [...host.vieworg];
        b.start[2] = f(b.start[2] - 22); // adjust for view height
      }
      const org: Vec3 = [f(b.start[0] + b.offset[0]), f(b.start[1] + b.offset[1]), f(b.start[2] + b.offset[2])];
      const dist = vectorSubtract(b.end, org);
      let yaw: number;
      let pitch: number;
      if (dist[1] === 0 && dist[0] === 0) {
        yaw = 0;
        pitch = dist[2] > 0 ? 90 : 270;
      } else {
        if (dist[0]) yaw = f(Math.atan2(dist[1], dist[0]) * 180 / Math.PI);
        else if (dist[1] > 0) yaw = 90;
        else yaw = 270;
        if (yaw < 0) yaw = f(yaw + 360);
        const forward = f(Math.sqrt(f(f(dist[0] * dist[0]) + f(dist[1] * dist[1]))));
        pitch = f(Math.atan2(dist[2], forward) * -180.0 / Math.PI);
        if (pitch < 0) pitch = f(pitch + 360.0);
      }
      // add new entities for the beams
      let dd = vectorNormalize(dist);
      const modelLength = 30.0;
      const steps = f(Math.ceil(f(dd / modelLength)));
      const len = f(f(dd - modelLength) / f(steps - 1));
      while (dd > 0) {
        const ent = zeroEntity();
        ent.origin = [...org];
        ent.model = b.model;
        ent.angles = [pitch, yaw, r.rand() % 360];
        host.addEntity(ent);
        for (let j = 0; j < 3; j++) org[j] = f(org[j] + f(dist[j] * len));
        dd = f(dd - modelLength);
      }
    }
  }

  /** CL_AddExplosions: each explosion's frame, fade and light for this moment. */
  private addExplosions(): void {
    const { host } = this;
    for (const ex of this.explosions) {
      if (ex.type === Ex.free) continue;
      const frac = f(f(host.time - ex.start) / 100.0);
      let fr = Math.floor(frac);
      const ent = ex.ent;
      switch (ex.type) {
        case Ex.mflash:
          if (fr >= ex.frames - 1) ex.type = Ex.free;
          break;
        case Ex.misc:
          if (fr >= ex.frames - 1) { ex.type = Ex.free; break; }
          ent.alpha = f(1.0 - f(frac / (ex.frames - 1)));
          break;
        case Ex.flash:
          if (fr >= 1) { ex.type = Ex.free; break; }
          ent.alpha = 1.0;
          break;
        case Ex.poly:
          if (fr >= ex.frames - 1) { ex.type = Ex.free; break; }
          ent.alpha = f((16.0 - fr) / 16.0);
          if (fr < 10) {
            ent.skinnum = fr >> 1;
            if (ent.skinnum < 0) ent.skinnum = 0;
          } else {
            ent.flags |= d.RF_TRANSLUCENT;
            ent.skinnum = fr < 13 ? 5 : 6;
          }
          break;
        case Ex.poly2:
          if (fr >= ex.frames - 1) { ex.type = Ex.free; break; }
          ent.alpha = f((5.0 - fr) / 5.0);
          ent.skinnum = 0;
          ent.flags |= d.RF_TRANSLUCENT;
          break;
      }
      if (ex.type === Ex.free) continue;
      if (ex.light) host.addLight(ent.origin, f(ex.light * ent.alpha), ex.lightcolor[0], ex.lightcolor[1], ex.lightcolor[2]);
      ent.oldorigin = [...ent.origin];
      if (fr < 0) fr = 0;
      ent.frame = ex.baseframe + fr + 1;
      ent.oldframe = ex.baseframe + fr;
      ent.backlerp = f(1.0 - host.lerpfrac);
      host.addEntity(ent);
    }
  }

  /** CL_AddLasers. */
  private addLasers(): void {
    for (const l of this.lasers) if (l.endtime >= this.host.time) this.host.addEntity(l.ent);
  }

  /** CL_AddTEnts. The player beams and sustains (both Rogue) never fill without the Rogue effects. */
  addTEnts(): void {
    this.addBeams();
    this.addExplosions();
    this.addLasers();
  }
}

/** MakeNormalVectors: a right and up for a forward vector. */
export function makeNormalVectors(forward: Vec3): { right: Vec3; up: Vec3 } {
  // this rotate and negate guarantees a vector not colinear with the original
  const right: Vec3 = [forward[2], -forward[0], forward[1]];
  const dd = dot(right, forward);
  const r2 = vectorMA(right, -dd, forward);
  vectorNormalize(r2);
  return { right: r2, up: crossProduct(r2, forward) };
}
