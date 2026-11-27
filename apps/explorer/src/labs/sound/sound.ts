// The sound lab's simulation, pure: one of the game's sounds played to a listener through the
// client's own mixer (ClientSound, the port of id's snd_dma.c, snd_mem.c and snd_mix.c that the demo
// lockstep oracle holds to id's client sample for sample), a client frame at a time, as CL_Frame
// runs S_Update. What comes out is the stereo the game would write to the sound card: 16-bit pairs
// at 22,050 a second, and each frame the two volumes S_Spatialize gave the channel.
import { ClientSound, virtualDevice, type SoundHost } from '@quake2ts/client';

export type V3 = [number, number, number];

/** The client's attenuations (q_shared.h): how fast a sound fades with distance. */
export const ATTENUATIONS = [
  { value: 0, key: 'none', label: 'None', detail: 'ATTN_NONE: full volume everywhere and no panning, for announcements.' },
  { value: 1, key: 'norm', label: 'Normal', detail: 'ATTN_NORM: weapons, doors and pickups. Silent past 2,080 units.' },
  { value: 2, key: 'idle', label: 'Idle', detail: "ATTN_IDLE: a monster's idle noises. Silent past 1,080 units." },
  { value: 3, key: 'static', label: 'Static', detail: "ATTN_STATIC: a map's ambient hums. Silent past 413 units." },
] as const;

/** SOUND_FULLVOLUME: closer than this, a sound loses nothing to distance. */
export const FULL_VOLUME = 80;

/** S_IssuePlaysound's dist_mult for an attenuation. */
export const distMult = (attenuation: number) => Math.fround(attenuation === 3 ? attenuation * 0.001 : attenuation * 0.0005);

/** How far away a sound of this attenuation goes silent, or null for one that never does. */
export function silentPast(attenuation: number): number | null {
  const m = distMult(attenuation);
  return m ? Math.round(FULL_VOLUME + 1 / m) : null;
}

/** Where the sound is: a still point, or going round the listener once in the run. */
export type Path = 'still' | 'round';

export interface SoundScene {
  /** The sound file's bytes (a WAV from the pak). */
  readonly wav: Uint8Array;
  /** Units from the listener. */
  readonly distance: number;
  /** Degrees from straight ahead, anticlockwise from above: 90 is the listener's left. */
  readonly bearing: number;
  readonly path: Path;
  /** The attenuation the game passes with the sound (ATTENUATIONS). */
  readonly attenuation: number;
  /** The sound's volume, 0 to 1, as the game passes it. */
  readonly volume: number;
  /** s_volume: the player's volume setting, 0.7 by default. */
  readonly master: number;
  /** s_loadas8bit: keep sounds as 8 bits a sample (the default), or 16. */
  readonly eightBit: boolean;
  /** Seconds to play. */
  readonly seconds: number;
  /** Milliseconds between client frames. */
  readonly frameMs: number;
}

/** One client frame: where the sound was, and the volumes the mixer gave each ear for it. */
export interface MixFrame {
  readonly timeMs: number;
  readonly origin: V3;
  readonly left: number;
  readonly right: number;
  /** The sound started again this frame (it had ended). */
  readonly started: boolean;
}

export interface Mix {
  /** The sound card's rate: 22,050 pairs a second. */
  readonly rate: number;
  /** The mixer's output, a sample per pair, -32,768 to 32,767. */
  readonly left: Int16Array;
  readonly right: Int16Array;
  readonly frames: readonly MixFrame[];
  /** How the mixer holds the sound after S_LoadSound: resampled to the card's rate, 8 or 16 bits. */
  readonly stored: { readonly samples: number; readonly width: number; readonly sourceRate: number; readonly sourceWidth: number };
  /** Samples where the mix hit the 16-bit limit and was clipped. */
  readonly clipped: number;
}

/** Where the sound is at a time: `bearing` degrees round from ahead, or that plus a turn over the run. */
export function sourceAt(scene: Pick<SoundScene, 'distance' | 'bearing' | 'path' | 'seconds'>, timeMs: number): V3 {
  const turn = scene.path === 'round' ? (timeMs / (scene.seconds * 1000)) * 360 : 0;
  const rad = ((scene.bearing + turn) * Math.PI) / 180;
  return [Math.fround(Math.cos(rad) * scene.distance), Math.fround(Math.sin(rad) * scene.distance), 0];
}

/** The sound's entity: anything but the player's own (playernum + 1), which is always full volume. */
const ENT = 2;
const NAME = 'lab.wav';

/** Plays the scene through the mixer and returns what it wrote. The listener stands at the origin facing +x. */
export function mixScene(scene: SoundScene): Mix {
  let clock = 0;
  let origin: V3 = sourceAt(scene, 0);
  const device = virtualDevice(() => clock);
  const host: SoundHost = {
    active: true,
    disableScreen: false,
    soundPrepped: true,
    playernum: 0,
    get servertime() {
      return clock;
    },
    entityOrigin: () => origin,
    entityNumber: (n) => n,
    frameEntities: () => [],
    soundPrecache: () => null,
    configstring: () => '',
    loadFile: (path) => (path === `sound/${NAME}` ? scene.wav : null),
  };
  const snd = new ClientSound(host, device, { volume: scene.master, loadas8bit: scene.eightBit });
  snd.beginRegistration();
  const sfx = snd.registerSound(NAME);
  snd.endRegistration();
  const cache = sfx && snd.loadSound(sfx);
  if (!sfx || !cache) throw new Error('The sound could not be read as a WAV.');
  const info = { sourceRate: 0, sourceWidth: 0 };
  {
    const dv = new DataView(scene.wav.buffer, scene.wav.byteOffset, scene.wav.byteLength);
    // the fmt chunk's rate and width, as the mixer read them (getWavinfo), for the facts
    for (let at = 12; at + 8 <= dv.byteLength;) {
      const id = String.fromCharCode(...scene.wav.subarray(at, at + 4));
      const len = dv.getInt32(at + 4, true);
      if (id === 'fmt ') {
        info.sourceRate = dv.getInt32(at + 12, true);
        info.sourceWidth = dv.getInt16(at + 22, true) / 8;
        break;
      }
      at += 8 + len + (len & 1);
    }
  }

  const rate = device.speed;
  const total = Math.round(scene.seconds * rate);
  const left = new Int16Array(total);
  const right = new Int16Array(total);
  const mask = (device.samples >> 1) - 1;
  let written = 0;
  let clipped = 0;
  const frames: MixFrame[] = [];
  const up: V3 = [0, 0, 1];
  const forward: V3 = [1, 0, 0];
  const rightVec: V3 = [0, -1, 0];
  let last = { left: 0, right: 0 };

  for (let timeMs = 0; written < total; timeMs += scene.frameMs) {
    clock = timeMs;
    origin = sourceAt(scene, timeMs);
    // the game fires the sound again once it has ended, so a short one keeps playing
    const playing = snd.channels.some((c) => c.sfx && c.entnum === ENT);
    const started = !playing && timeMs < scene.seconds * 1000;
    if (started) snd.startSound(null, ENT, 1, sfx, scene.volume, scene.attenuation, 0);
    snd.update([0, 0, 0], forward, rightVec, up);
    const ch = snd.channels.find((c) => c.sfx && c.entnum === ENT);
    if (ch) last = { left: ch.leftvol, right: ch.rightvol };
    frames.push({ timeMs, origin, left: last.left, right: last.right, started });
    const buf = device.buffer;
    for (; written < snd.paintedtime && written < total; written++) {
      const l = buf[(written & mask) * 2]!;
      const r = buf[(written & mask) * 2 + 1]!;
      if (l === 32767 || l === -32768 || r === 32767 || r === -32768) clipped++;
      left[written] = l;
      right[written] = r;
    }
  }
  return { rate, left, right, frames, clipped, stored: { samples: cache.length, width: cache.width, ...info } };
}

/** The lowest and highest sample of each of `buckets` slices, scaled to -1..1, for a waveform. */
export function peaks(samples: Int16Array, buckets: number): { min: Float32Array; max: Float32Array } {
  const min = new Float32Array(buckets);
  const max = new Float32Array(buckets);
  const per = samples.length / buckets;
  for (let b = 0; b < buckets; b++) {
    let lo = 0;
    let hi = 0;
    for (let i = Math.floor(b * per), end = Math.min(samples.length, Math.floor((b + 1) * per)); i < end; i++) {
      const s = samples[i]!;
      if (s < lo) lo = s;
      if (s > hi) hi = s;
    }
    min[b] = lo / 32768;
    max[b] = hi / 32768;
  }
  return { min, max };
}
