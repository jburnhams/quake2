// The effects lab's simulation, pure: one of the game's effects fired once, run through the client's
// own effects code (ClientEffects, the port of id's cl_fx.c and cl_tent.c that the demo lockstep
// oracle holds to id's client particle for particle), a client frame at a time, as CL_Frame runs it.
// Everything a frame draws is what V_RenderView would hand the renderer: particles, dynamic lights
// and the models of explosions and beams. Nothing is random: the effects draw from rand(), seeded,
// so a seed and a time always give the same picture.
import { ClientEffects, Rand, originalTables as t, type FxEntity, type FxHost, type RefEntity } from '@quake2ts/client';

export type V3 = [number, number, number];

export interface EffectParticle { readonly origin: V3; readonly color: number; readonly alpha: number }
export interface EffectLight { readonly origin: V3; readonly color: V3; readonly intensity: number }

/** What one client frame draws. */
export interface EffectFrame {
  readonly timeMs: number;
  readonly particles: readonly EffectParticle[];
  readonly lights: readonly EffectLight[];
  readonly models: readonly RefEntity[];
}

/** Where an effect goes off: a point on a surface, the surface's normal, and the way the shot came. */
export interface EffectSpot {
  readonly origin: V3;
  readonly normal: V3;
  /** Where a trail (a rail shot, a rocket) starts from. */
  readonly from: V3;
}

type Fire = (fx: ClientEffects, spot: EffectSpot, ent: FxEntity) => void;

export interface Effect {
  readonly label: string;
  /** What fires it in the game, in one sentence. */
  readonly detail: string;
  /** The C function the lab's code section shows. */
  readonly code: string;
  /** Fired once, at time 0. */
  readonly fire?: Fire;
  /** For a moving thing: called each frame with where it has got to (a rocket in flight). */
  readonly fly?: { readonly speed: number; readonly every: (fx: ClientEffects, from: V3, to: V3, ent: FxEntity) => void };
}

const te = (type: number, pick?: (s: EffectSpot) => Partial<{ pos: V3; pos2: V3; dir: V3; cnt: number; color: number }>): Fire => (fx, s) =>
  fx.tempEntity({ type, pos: s.origin, pos2: [0, 0, 0], dir: s.normal, ...pick?.(s) });

/** The effects to fire, in the order the picker lists them. */
export const EFFECTS: Record<string, Effect> = {
  rocket: {
    label: 'Rocket explosion',
    detail: 'TE_ROCKET_EXPLOSION: the explosion model, 256 sparks and a light.',
    code: 'CL_ExplosionParticles',
    fire: te(t.TE_ROCKET_EXPLOSION),
  },
  grenade: {
    label: 'Grenade explosion',
    detail: 'TE_GRENADE_EXPLOSION: the same sparks, a longer run of the model.',
    code: 'CL_ExplosionParticles',
    fire: te(t.TE_GRENADE_EXPLOSION),
  },
  blaster: {
    label: 'Blaster hit',
    detail: 'TE_BLASTER: 40 sparks thrown off the wall, a flash model and a light.',
    code: 'CL_BlasterParticles',
    fire: te(t.TE_BLASTER),
  },
  gunshot: {
    label: 'Bullet hit',
    detail: 'TE_GUNSHOT: a puff of 40 grey particles, smoke and a flash.',
    code: 'CL_ParticleEffect',
    fire: te(t.TE_GUNSHOT),
  },
  blood: {
    label: 'Blood',
    detail: 'TE_BLOOD: 60 red particles where a bullet hits flesh.',
    code: 'CL_ParticleEffect',
    fire: te(t.TE_BLOOD),
  },
  rail: {
    label: 'Railgun shot',
    detail: 'TE_RAILTRAIL: a blue spiral round the line, and a grey core.',
    code: 'CL_RailTrail',
    fire: te(t.TE_RAILTRAIL, (s) => ({ pos: s.from, pos2: s.origin })),
  },
  bfg: {
    label: 'BFG explosion',
    detail: 'TE_BFG_BIGEXPLOSION and TE_BFG_EXPLOSION: green sparks, the BFG sprite and a green light.',
    code: 'CL_ExplosionParticles',
    fire: (fx, s) => {
      fx.tempEntity({ type: t.TE_BFG_BIGEXPLOSION, pos: s.origin, pos2: [0, 0, 0], dir: s.normal });
      fx.tempEntity({ type: t.TE_BFG_EXPLOSION, pos: s.origin, pos2: [0, 0, 0], dir: s.normal });
    },
  },
  teleport: {
    label: 'Player teleport',
    detail: 'EV_PLAYER_TELEPORT: 1,053 particles in a block, flung outwards.',
    code: 'CL_TeleportParticles',
    fire: (fx, s) => fx.entityEvent({ ...nullState(), number: 1, origin: [...s.origin], event: 6 }),
  },
  respawn: {
    label: 'Item respawn',
    detail: 'EV_ITEM_RESPAWN: 64 green particles that hang and fade.',
    code: 'CL_ItemRespawnParticles',
    fire: (fx, s) => fx.entityEvent({ ...nullState(), number: 1, origin: [...s.origin], event: 1 }),
  },
  boss: {
    label: 'Boss teleport',
    detail: 'TE_BOSSTPORT: 4,096 particles asked for, as many as the client has.',
    code: 'CL_BigTeleportParticles',
    fire: te(t.TE_BOSSTPORT),
  },
  rocketTrail: {
    label: 'Rocket in flight',
    detail: 'A rocket at 650 units a second: smoke that thins as it flies, and sparks of fire.',
    code: 'CL_RocketTrail',
    fly: { speed: 650, every: (fx, from, to, ent) => fx.rocketTrail(from, to, ent) },
  },
  grenadeTrail: {
    label: 'Grenade in flight',
    detail: 'A grenade at 600 units a second: a smoke trail with fewer particles the longer it flies.',
    code: 'CL_DiminishingTrail',
    fly: { speed: 600, every: (fx, from, to, ent) => fx.diminishingTrail(from, to, ent, 0x20) },
  },
};
export const EFFECT_KEYS = Object.keys(EFFECTS);

function nullState() {
  return {
    number: 0, origin: [0, 0, 0] as V3, angles: [0, 0, 0] as V3, old_origin: [0, 0, 0] as V3,
    modelindex: 0, modelindex2: 0, modelindex3: 0, modelindex4: 0,
    frame: 0, skinnum: 0, effects: 0, renderfx: 0, solid: 0, sound: 0, event: 0,
  };
}

/** Rand, counting its draws. */
class CountingRand extends Rand {
  draws = 0;
  override rand(): number {
    this.draws++;
    return super.rand();
  }
}

export interface RunOptions {
  /** rand()'s seed: 1 is an unseeded program's, as the game's. */
  readonly seed: number;
  /** PARTICLE_GRAVITY: 40 in the game. */
  readonly gravity: number;
  /** Milliseconds a client frame: 25 at the demo's 40 frames a second. */
  readonly frameMs: number;
  /** The models the effects would load (all of them, unless a test says otherwise). */
  readonly hasModel?: (name: string) => boolean;
}

export interface Run {
  /** One entry per client frame, from time 0. */
  readonly frames: readonly EffectFrame[];
  /** rand() draws over the whole run. */
  readonly draws: number;
  /** rand() draws the firing took. */
  readonly drawsToFire: number;
}

/**
 * Fires `effect` at `spot` at time 0 and runs the client's effects for `durationMs`, a frame at a
 * time: what each frame draws (CL_AddTEnts, CL_AddParticles, CL_AddDLights), then CL_RunDLights.
 */
export function runEffect(effect: Effect, spot: EffectSpot, durationMs: number, options: RunOptions): Run {
  let time = 0;
  let frametime = 0;
  let particles: EffectParticle[] = [];
  let lights: EffectLight[] = [];
  let models: RefEntity[] = [];
  const ent: FxEntity = { current: { ...nullState(), origin: [...spot.from] }, trailcount: 1024, fly_stoptime: 0, lerp_origin: [...spot.from] };
  const host: FxHost = {
    get time() { return time; },
    get frametime() { return frametime; },
    // The effect arrives with the frame being drawn: cl.time at the frame's own server time.
    get servertime() { return time; },
    lerpfrac: 1,
    playernum: 0,
    vieworg: [0, 0, 0],
    footsteps: false,
    entity: () => ent,
    addEntity: (e) => { models.push({ ...e, origin: [...e.origin], oldorigin: [...e.oldorigin], angles: [...e.angles] }); },
    addLight: (origin, intensity, r, g, b) => { lights.push({ origin: [...origin], color: [r, g, b], intensity }); },
    addParticle: (origin, color, alpha) => { if (particles.length < 4096) particles.push({ origin: [...origin], color, alpha }); },
    startSound: () => {},
  };
  const rand = new CountingRand(options.seed);
  const fx = new ClientEffects(host, rand);
  fx.gravity = options.gravity;
  const has = options.hasModel ?? (() => true);
  fx.registerModels((name) => (has(name) ? name : null));

  effect.fire?.(fx, spot, ent);
  const drawsToFire = rand.draws;

  // A flight goes from `from` to the spot and stops there.
  const flight = effect.fly ? distance(spot.from, spot.origin) / effect.fly.speed * 1000 : 0;
  const frames: EffectFrame[] = [];
  for (let k = 0; time <= durationMs; k++) {
    if (effect.fly && k > 0) {
      const at = (ms: number) => lerp(spot.from, spot.origin, Math.min(1, ms / flight));
      const from = at(time - options.frameMs);
      const to = at(time);
      if (time - options.frameMs < flight) effect.fly.every(fx, from, to, ent);
      ent.lerp_origin = [...to];
    }
    particles = [];
    lights = [];
    models = [];
    fx.addTEnts();
    fx.addParticles();
    fx.addDlights();
    frames.push({ timeMs: time, particles, lights, models });
    frametime = Math.fround(options.frameMs / 1000);
    fx.runDlights();
    time += options.frameMs;
  }
  return { frames, draws: rand.draws, drawsToFire };
}

const distance = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerp = (a: V3, b: V3, s: number): V3 => [
  Math.fround(a[0] + (b[0] - a[0]) * s),
  Math.fround(a[1] + (b[1] - a[1]) * s),
  Math.fround(a[2] + (b[2] - a[2]) * s),
];

/** A palette index as RGBA in 0..1, from the game's 768-byte palette (pics/colormap.pcx). */
export function paletteColour(palette: Uint8Array, index: number, alpha: number): [number, number, number, number] {
  const i = (index & 255) * 3;
  return [palette[i]! / 255, palette[i + 1]! / 255, palette[i + 2]! / 255, alpha];
}
