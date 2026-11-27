// The client's sound, ported from id's snd_dma.c (starting sounds, channels, spatialisation, loop
// sounds), snd_mem.c (loading and resampling WAVs) and snd_mix.c (painting the channels into the
// DMA buffer), 3.21. The demo lockstep holds it to id's own: the same channels on every frame and
// the same samples in the buffer.
//
// It runs over a DMA device the platform gives it (SNDDMA_*: a ring of 16-bit stereo samples and the
// position the hardware has played to), so a browser, a test or the lockstep can each supply theirs.
// Float expressions follow the C: float32 where the C stores or computes a float, double where it
// mixes in a double literal (0.001, 0.5, 1.0), truncated where it converts to int.
//
// Two places differ from snd_mix.c's C and follow the i386 assembly the game shipped with (snd_mixa.s):
// S_PaintChannelFrom8 picks its scale table row by volume >> 3 (the C takes volume >> 11, which is
// always row 0, so every 8-bit sound would mix as silence), and it clamps the volumes without writing
// them back to the channel.

import { CS_PLAYERSKINS } from './defs.js';
import { dot, vectorNormalize, type Vec3 } from './qmath.js';

const f = Math.fround;

export const MAX_CHANNELS = 32;
export const MAX_PLAYSOUNDS = 128;
const MAX_SFX = 256 * 2;
const PAINTBUFFER_SIZE = 2048;
const SOUND_FULLVOLUME = 80;
const SOUND_LOOPATTENUATE = f(0.003);
const ATTN_STATIC = 3;

/** sfxcache_t: a sound resampled to the device's rate, as 8-bit (signed) or 16-bit samples. */
export interface SfxCache {
  length: number;
  loopstart: number;
  speed: number;
  width: number;
  stereo: number;
  data: Int8Array | Int16Array;
}

/** sfx_t: a sound known by name; `truename` is the file an alias (a sexed sound) plays. */
export interface Sfx {
  name: string;
  truename?: string;
  cache: SfxCache | null;
}

/** channel_t. */
export interface Channel {
  sfx: Sfx | null;
  leftvol: number;
  rightvol: number;
  end: number;
  pos: number;
  entnum: number;
  entchannel: number;
  origin: Vec3;
  dist_mult: number;
  master_vol: number;
  fixed_origin: boolean;
  autosound: boolean;
}

interface Playsound {
  sfx: Sfx | null;
  volume: number;
  attenuation: number;
  entnum: number;
  entchannel: number;
  fixed_origin: boolean;
  origin: Vec3;
  /** unsigned in the C */
  begin: number;
}

/** dma_t, and SNDDMA_GetDMAPos: the platform's ring of samples. Only 16-bit stereo is mixed here. */
export interface SoundDevice {
  readonly channels: number;
  /** Mono samples in the buffer (a power of two). */
  readonly samples: number;
  readonly submissionChunk: number;
  readonly speed: number;
  readonly buffer: Int16Array;
  /** Where the hardware has played to, in mono samples. */
  getDmaPos(): number;
}

/** A device that plays at a virtual clock (the lockstep harness's SNDDMA_GetDMAPos). */
export function virtualDevice(clockMs: () => number, speed = 22050, samples = 65536): SoundDevice {
  const buffer = new Int16Array(samples);
  return {
    channels: 2,
    samples,
    submissionChunk: 1,
    speed,
    buffer,
    // the "hardware" has played up to the clock
    getDmaPos: () => Number(((BigInt(clockMs()) * BigInt(speed)) / 1000n * 2n) % BigInt(samples)),
  };
}

/** What the sound needs from the client (cl, cls and cl_entities). */
export interface SoundHost {
  /** cls.state == ca_active */
  readonly active: boolean;
  /** cls.disable_screen: the loading plaque is up. */
  readonly disableScreen: boolean;
  /** cl.sound_prepped */
  readonly soundPrepped: boolean;
  readonly playernum: number;
  /** cl.frame.servertime */
  readonly servertime: number;
  /** CL_GetEntitySoundOrigin: the entity's lerp_origin. */
  entityOrigin(ent: number): Vec3;
  /** cl_entities[ent].current.number */
  entityNumber(ent: number): number;
  /** The current frame's entities (cl_parse_entities), for their loop sounds. */
  frameEntities(): readonly { origin: Vec3; sound: number }[];
  /** cl.sound_precache */
  soundPrecache(index: number): Sfx | null;
  configstring(index: number): string;
  /** FS_LoadFile: null when there is no such file. */
  loadFile(path: string): Uint8Array | null;
}

export interface SoundOptions {
  /** s_volume: 0.7 */
  volume?: number;
  /** s_loadas8bit: 1 */
  loadas8bit?: boolean;
  /** s_mixahead: 0.2 seconds */
  mixahead?: number;
}

const emptyChannel = (): Channel => ({
  sfx: null, leftvol: 0, rightvol: 0, end: 0, pos: 0, entnum: 0, entchannel: 0, origin: [0, 0, 0],
  dist_mult: 0, master_vol: 0, fixed_origin: false, autosound: false,
});

/** snd_dma.c, snd_mem.c and snd_mix.c for one client. */
export class ClientSound {
  readonly channels: Channel[] = Array.from({ length: MAX_CHANNELS }, emptyChannel);
  /** Samples the mixer has painted up to. */
  paintedtime = 0;
  /** Samples the device has played up to. */
  soundtime = 0;
  listener_origin: Vec3 = [0, 0, 0];
  listener_forward: Vec3 = [0, 0, 0];
  listener_right: Vec3 = [0, 0, 0];
  listener_up: Vec3 = [0, 0, 0];

  private readonly known = new Map<string, Sfx>();
  /** s_pendingplays, sorted by begin. */
  private pending: Playsound[] = [];
  /**
   * s_freeplays, its head last. The playsounds are reused as they are: one that follows an entity
   * keeps the origin a fixed one last had, and that stale origin reaches its channel.
   */
  private freeplays: Playsound[] = [];
  private beginofs = 0;
  private buffers = 0;
  private oldsamplepos = 0;
  private readonly volume: number;
  private readonly loadas8bit: boolean;
  private readonly mixahead: number;
  private readonly scaletable: Int32Array[] = Array.from({ length: 32 }, () => new Int32Array(256));
  private readonly paintbuffer = new Int32Array(PAINTBUFFER_SIZE * 2);
  /** null when there is no device: S_Init failed, and every call does nothing (sound_started 0). */
  private readonly dma: SoundDevice | null;

  constructor(private readonly host: SoundHost, device: SoundDevice | null, options: SoundOptions = {}) {
    this.volume = f(options.volume ?? 0.7);
    this.loadas8bit = options.loadas8bit ?? true;
    this.mixahead = f(options.mixahead ?? 0.2);
    this.dma = device;
    if (!device) return;
    this.initScaletable();
    this.stopAllSounds();
  }

  get started(): boolean {
    return this.dma !== null;
  }

  // ---------------------------------------------------------------- registering (snd_dma.c)

  /** S_FindName */
  private findName(name: string, create: boolean): Sfx | null {
    if (!name) throw new Error('S_FindName: empty name');
    if (name.length >= 64) throw new Error(`Sound name too long: ${name}`);
    const known = this.known.get(name);
    if (known || !create) return known ?? null;
    if (this.known.size === MAX_SFX) throw new Error('S_FindName: out of sfx_t');
    const sfx: Sfx = { name, cache: null };
    this.known.set(name, sfx);
    return sfx;
  }

  /** S_AliasName: a name that plays another file. */
  private aliasName(aliasname: string, truename: string): Sfx {
    const sfx: Sfx = { name: aliasname, truename, cache: null };
    this.known.set(aliasname, sfx);
    return sfx;
  }

  /**
   * S_RegisterSound. Outside S_BeginRegistration the sound loads at once, and CL_RegisterSounds'
   * S_EndRegistration loads everything it registered, so a registered sound is always loaded.
   */
  registerSound(name: string): Sfx | null {
    if (!this.dma) return null;
    const sfx = this.findName(name, true)!;
    this.loadSound(sfx);
    return sfx;
  }

  /** S_RegisterSexedSound: "*pain50_1.wav" as the entity's player model's, or the male's. */
  private registerSexedSound(entnum: number, base: string): Sfx | null {
    let model = '';
    const n = this.host.entityNumber(entnum);
    const cs = this.host.configstring(CS_PLAYERSKINS + n - 1);
    if (cs) {
      const slash = cs.indexOf('\\');
      if (slash >= 0) model = cs.slice(slash + 1).split('/')[0];
    }
    if (!model) model = 'male';
    const sexed = `#players/${model}/${base.slice(1)}`;
    let sfx = this.findName(sexed, false);
    if (!sfx) {
      if (this.host.loadFile(sexed.slice(1))) sfx = this.registerSound(sexed);
      else sfx = this.aliasName(sexed, `player/male/${base.slice(1)}`);
    }
    return sfx;
  }

  // ---------------------------------------------------------------- loading (snd_mem.c)

  /** S_LoadSound: null for a placeholder ("*" sexed name) or a file that will not load. */
  loadSound(s: Sfx): SfxCache | null {
    if (s.name[0] === '*') return null;
    if (s.cache) return s.cache;
    const name = s.truename ?? s.name;
    const path = name[0] === '#' ? name.slice(1) : `sound/${name}`;
    const data = this.host.loadFile(path);
    if (!data) return null;
    const info = getWavinfo(s.name, data);
    if (info.channels !== 1) return null; // a stereo sample
    const sc: SfxCache = { length: info.samples, loopstart: info.loopstart, speed: info.rate, width: info.width, stereo: info.channels, data: new Int8Array(0) };
    s.cache = sc;
    this.resampleSfx(sc, sc.speed, sc.width, data.subarray(info.dataofs));
    return sc;
  }

  /** ResampleSfx: to the device's rate, by a fixed-point step of 1/256ths. */
  private resampleSfx(sc: SfxCache, inrate: number, inwidth: number, data: Uint8Array): void {
    const speed = this.dma!.speed;
    const stepscale = f(inrate / speed); // (float)inrate / dma.speed
    const outcount = Math.trunc(f(sc.length / stepscale));
    sc.length = outcount;
    if (sc.loopstart !== -1) sc.loopstart = Math.trunc(f(sc.loopstart / stepscale));
    sc.speed = speed;
    sc.width = this.loadas8bit ? 1 : inwidth;
    sc.stereo = 0;
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (stepscale === 1 && inwidth === 1 && sc.width === 1) {
      const out = new Int8Array(outcount);
      for (let i = 0; i < outcount; i++) out[i] = data[i] - 128;
      sc.data = out;
      return;
    }
    const out = sc.width === 2 ? new Int16Array(outcount) : new Int8Array(outcount);
    let samplefrac = 0;
    const fracstep = Math.trunc(f(stepscale * 256));
    for (let i = 0; i < outcount; i++) {
      const srcsample = samplefrac >> 8;
      samplefrac += fracstep;
      const sample = inwidth === 2 ? view.getInt16(srcsample * 2, true) : (data[srcsample] - 128) << 8;
      out[i] = sc.width === 2 ? sample : sample >> 8;
    }
    sc.data = out;
  }

  // ---------------------------------------------------------------- channels (snd_dma.c)

  /** S_PickChannel: the entity's own channel, else the one closest to its end. */
  private pickChannel(entnum: number, entchannel: number): Channel | null {
    if (entchannel < 0) throw new Error('S_PickChannel: entchannel<0');
    let firstToDie = -1;
    let lifeLeft = 0x7fffffff;
    const player = this.host.playernum + 1;
    for (let i = 0; i < MAX_CHANNELS; i++) {
      const ch = this.channels[i];
      if (entchannel !== 0 && ch.entnum === entnum && ch.entchannel === entchannel) {
        // always override sound from same entity
        firstToDie = i;
        break;
      }
      // don't let monster sounds override player sounds
      if (ch.entnum === player && entnum !== player && ch.sfx) continue;
      if (ch.end - this.paintedtime < lifeLeft) {
        lifeLeft = ch.end - this.paintedtime;
        firstToDie = i;
      }
    }
    if (firstToDie === -1) return null;
    this.channels[firstToDie] = emptyChannel();
    return this.channels[firstToDie];
  }

  /** S_SpatializeOrigin: [left, right] volumes for a sound at `origin`. */
  private spatializeOrigin(origin: readonly number[], masterVol: number, distMult: number): [number, number] {
    if (!this.host.active) return [255, 255];
    const sourceVec = [f(origin[0] - this.listener_origin[0]), f(origin[1] - this.listener_origin[1]), f(origin[2] - this.listener_origin[2])];
    let dist = vectorNormalize(sourceVec);
    dist = f(dist - SOUND_FULLVOLUME);
    if (dist < 0) dist = 0; // close enough to be at full volume
    dist = f(dist * distMult);
    const d = dot(this.listener_right, sourceVec);
    let rscale: number;
    let lscale: number;
    if (this.dma!.channels === 1 || !distMult) {
      rscale = 1.0;
      lscale = 1.0;
    } else {
      rscale = f(0.5 * (1.0 + d));
      lscale = f(0.5 * (1.0 - d));
    }
    // add in distance effect
    let scale = f((1.0 - dist) * rscale);
    let right = Math.trunc(f(masterVol * scale));
    if (right < 0) right = 0;
    scale = f((1.0 - dist) * lscale);
    let left = Math.trunc(f(masterVol * scale));
    if (left < 0) left = 0;
    return [left, right];
  }

  /** S_Spatialize */
  private spatialize(ch: Channel): void {
    // anything coming from the view entity will always be full volume
    if (ch.entnum === this.host.playernum + 1) {
      ch.leftvol = ch.master_vol;
      ch.rightvol = ch.master_vol;
      return;
    }
    const origin = ch.fixed_origin ? ch.origin : this.host.entityOrigin(ch.entnum);
    [ch.leftvol, ch.rightvol] = this.spatializeOrigin(origin, ch.master_vol, ch.dist_mult);
  }

  /** S_IssuePlaysound: a pending sound takes a channel. */
  private issuePlaysound(ps: Playsound): void {
    const ch = this.pickChannel(ps.entnum, ps.entchannel);
    if (!ch) {
      this.freePlaysound(ps);
      return;
    }
    ch.dist_mult = ps.attenuation === ATTN_STATIC ? f(ps.attenuation * 0.001) : f(ps.attenuation * 0.0005);
    ch.master_vol = Math.trunc(ps.volume);
    ch.entnum = ps.entnum;
    ch.entchannel = ps.entchannel;
    ch.sfx = ps.sfx;
    ch.origin = [...ps.origin];
    ch.fixed_origin = ps.fixed_origin;
    this.spatialize(ch);
    ch.pos = 0;
    const sc = this.loadSound(ch.sfx!)!;
    ch.end = this.paintedtime + sc.length;
    this.freePlaysound(ps);
  }

  /** S_FreePlaysound: off the pending list, onto the free list's head. */
  private freePlaysound(ps: Playsound): void {
    this.pending.splice(this.pending.indexOf(ps), 1);
    this.freeplays.push(ps);
  }

  /**
   * S_StartSound: queues the sound to begin at the server frame's time (drifting s_beginofs), or at
   * once when it has no offset. A null origin follows the entity.
   */
  startSound(origin: Vec3 | null, entnum: number, entchannel: number, sfx: Sfx | null, fvol: number, attenuation: number, timeofs: number): void {
    const dma = this.dma;
    if (!dma || !sfx) return;
    if (sfx.name[0] === '*') sfx = this.registerSexedSound(entnum, sfx.name);
    if (!sfx || !this.loadSound(sfx)) return; // couldn't load the sound's data
    const vol = Math.trunc(f(fvol * 255));
    // S_AllocPlaysound
    const ps = this.freeplays.pop();
    if (!ps) return; // no free playsounds
    if (origin) {
      ps.origin = [...origin];
      ps.fixed_origin = true;
    } else {
      ps.fixed_origin = false;
    }
    ps.entnum = entnum;
    ps.entchannel = entchannel;
    ps.attenuation = attenuation;
    ps.volume = vol;
    ps.sfx = sfx;
    // drift s_beginofs
    const servertime = this.host.servertime;
    let start = Math.trunc(servertime * 0.001 * dma.speed + this.beginofs);
    if (start < this.paintedtime) {
      start = this.paintedtime;
      this.beginofs = Math.trunc(start - servertime * 0.001 * dma.speed);
    } else if (start > this.paintedtime + 0.3 * dma.speed) {
      start = Math.trunc(this.paintedtime + 0.1 * dma.speed);
      this.beginofs = Math.trunc(start - servertime * 0.001 * dma.speed);
    } else {
      this.beginofs -= 10;
    }
    ps.begin = !timeofs ? this.paintedtime >>> 0 : Math.trunc(f(start + f(timeofs * dma.speed))) >>> 0;
    // sort into the pending sound list
    let at = 0;
    while (at < this.pending.length && this.pending[at].begin < ps.begin) at++;
    this.pending.splice(at, 0, ps);
  }

  /** S_StartLocalSound: at the listener, on the player's channel 0. */
  startLocalSound(name: string): void {
    if (!this.dma) return;
    const sfx = this.registerSound(name);
    if (!sfx) return;
    this.startSound(null, this.host.playernum + 1, 0, sfx, 1, 1, 0);
  }

  /** S_ClearBuffer */
  clearBuffer(): void {
    this.dma?.buffer.fill(0);
  }

  /** S_StopAllSounds: no pending sounds, no channels, a silent buffer. */
  stopAllSounds(): void {
    if (!this.dma) return;
    // clear all the playsounds: each is put at the free list's head in turn, so the last is taken first
    this.pending = [];
    this.freeplays = Array.from({ length: MAX_PLAYSOUNDS }, (): Playsound => ({
      sfx: null, volume: 0, attenuation: 0, entnum: 0, entchannel: 0, fixed_origin: false, origin: [0, 0, 0], begin: 0,
    }));
    for (let i = 0; i < MAX_CHANNELS; i++) this.channels[i] = emptyChannel();
    this.clearBuffer();
  }

  /** S_AddLoopSounds: each entity's ->sound, merged per sound into one channel for this frame. */
  private addLoopSounds(): void {
    if (!this.host.active || !this.host.soundPrepped) return;
    const ents = this.host.frameEntities();
    const sounds = ents.map((e) => e.sound);
    for (let i = 0; i < ents.length; i++) {
      if (!sounds[i]) continue;
      const sfx = this.host.soundPrecache(sounds[i]);
      if (!sfx) continue; // bad sound effect
      const sc = sfx.cache;
      if (!sc) continue;
      // find the total contribution of all sounds of this type
      let [leftTotal, rightTotal] = this.spatializeOrigin(ents[i].origin, 255.0, SOUND_LOOPATTENUATE);
      for (let j = i + 1; j < ents.length; j++) {
        if (sounds[j] !== sounds[i]) continue;
        sounds[j] = 0; // don't check this again later
        const [left, right] = this.spatializeOrigin(ents[j].origin, 255.0, SOUND_LOOPATTENUATE);
        leftTotal += left;
        rightTotal += right;
      }
      if (leftTotal === 0 && rightTotal === 0) continue; // not audible
      const ch = this.pickChannel(0, 0);
      if (!ch) return;
      ch.leftvol = Math.min(leftTotal, 255);
      ch.rightvol = Math.min(rightTotal, 255);
      ch.autosound = true; // remove next frame
      ch.sfx = sfx;
      ch.pos = this.paintedtime % sc.length;
      ch.end = this.paintedtime + sc.length - ch.pos;
    }
  }

  /** S_Update: the listener moves, every channel is spatialised again, and the mixer runs ahead. */
  update(origin: readonly number[], forward: readonly number[], right: readonly number[], up: readonly number[]): void {
    if (!this.dma) return;
    // if the loading plaque is up, clear everything out
    if (this.host.disableScreen) {
      this.clearBuffer();
      return;
    }
    this.listener_origin = [...origin] as Vec3;
    this.listener_forward = [...forward] as Vec3;
    this.listener_right = [...right] as Vec3;
    this.listener_up = [...up] as Vec3;
    for (let i = 0; i < MAX_CHANNELS; i++) {
      const ch = this.channels[i];
      if (!ch.sfx) continue;
      if (ch.autosound) {
        // autosounds are regenerated fresh each frame
        this.channels[i] = emptyChannel();
        continue;
      }
      this.spatialize(ch);
      if (!ch.leftvol && !ch.rightvol) this.channels[i] = emptyChannel();
    }
    this.addLoopSounds();
    this.update_();
  }

  /** GetSoundtime: the device's position as a count of samples, counting the ring's wraps. */
  private getSoundtime(): void {
    const dma = this.dma!;
    const fullsamples = Math.trunc(dma.samples / dma.channels);
    const samplepos = dma.getDmaPos();
    if (samplepos < this.oldsamplepos) {
      this.buffers++; // buffer wrapped
      if (this.paintedtime > 0x40000000) {
        // time to chop things off to avoid 32 bit limits
        this.buffers = 0;
        this.paintedtime = fullsamples;
        this.stopAllSounds();
      }
    }
    this.oldsamplepos = samplepos;
    this.soundtime = this.buffers * fullsamples + Math.trunc(samplepos / dma.channels);
  }

  /** S_Update_: paints from where it got to up to s_mixahead past the device. */
  private update_(): void {
    const dma = this.dma!;
    this.getSoundtime();
    // check to make sure that we haven't overshot
    if (this.paintedtime < this.soundtime) this.paintedtime = this.soundtime;
    // mix ahead of current position (unsigned endtime)
    let endtime = Math.trunc(f(this.soundtime + f(this.mixahead * dma.speed))) >>> 0;
    // mix to an even submission block size
    endtime = ((endtime + dma.submissionChunk - 1) & ~(dma.submissionChunk - 1)) >>> 0;
    const samps = dma.samples >> (dma.channels - 1);
    if (((endtime - this.soundtime) >>> 0) > samps) endtime = this.soundtime + samps;
    this.paintChannels(endtime);
  }

  // ---------------------------------------------------------------- mixing (snd_mix.c)

  /** S_InitScaletable: 32 volume rows of each signed 8-bit sample scaled. */
  private initScaletable(): void {
    for (let i = 0; i < 32; i++) {
      const scale = Math.trunc(f(i * 8 * 256 * this.volume));
      for (let j = 0; j < 256; j++) this.scaletable[i][j] = Math.imul((j << 24) >> 24, scale);
    }
  }

  /** S_PaintChannels: starts the pending sounds whose time has come, and paints every channel. */
  private paintChannels(endtime: number): void {
    const sndVol = Math.trunc(f(this.volume * 256));
    while (this.paintedtime < endtime) {
      // if paintbuffer is smaller than DMA buffer
      let end = endtime;
      if (endtime - this.paintedtime > PAINTBUFFER_SIZE) end = this.paintedtime + PAINTBUFFER_SIZE;
      // start any playsounds
      for (;;) {
        const ps = this.pending[0];
        if (!ps) break;
        if (ps.begin <= this.paintedtime >>> 0) {
          this.issuePlaysound(ps);
          continue;
        }
        if (ps.begin < end >>> 0) end = ps.begin; // stop here
        break;
      }
      // clear the paint buffer (no raw samples are streamed here)
      this.paintbuffer.fill(0, 0, (end - this.paintedtime) * 2);
      // paint in the channels
      for (let i = 0; i < MAX_CHANNELS; i++) {
        const ch = this.channels[i];
        let ltime = this.paintedtime;
        while (ltime < end) {
          if (!ch.sfx || (!ch.leftvol && !ch.rightvol)) break;
          // max painting is to the end of the buffer, and might be stopped by running out of data
          let count = end - ltime;
          if (ch.end - ltime < count) count = ch.end - ltime;
          const sc = this.loadSound(ch.sfx);
          if (!sc) break;
          if (count > 0 && ch.sfx) {
            if (sc.width === 1) this.paintChannelFrom8(ch, sc, count, ltime - this.paintedtime);
            else this.paintChannelFrom16(ch, sc, count, ltime - this.paintedtime, sndVol);
            ltime += count;
          }
          // if at end of loop, restart
          if (ltime >= ch.end) {
            if (ch.autosound) {
              // autolooping sounds always go back to start
              ch.pos = 0;
              ch.end = ltime + sc.length;
            } else if (sc.loopstart >= 0) {
              ch.pos = sc.loopstart;
              ch.end = ltime + sc.length - ch.pos;
            } else {
              ch.sfx = null; // channel just stopped
            }
          }
        }
      }
      // transfer out according to DMA format
      this.transferStereo16(end);
      this.paintedtime = end;
    }
  }

  /** S_PaintChannelFrom8, as snd_mixa.s: the volume's row is volume >> 3, clamped but not stored. */
  private paintChannelFrom8(ch: Channel, sc: SfxCache, count: number, offset: number): void {
    const lscale = this.scaletable[Math.min(ch.leftvol >>> 0, 255) >> 3];
    const rscale = this.scaletable[Math.min(ch.rightvol >>> 0, 255) >> 3];
    const data = sc.data;
    const pb = this.paintbuffer;
    for (let i = 0; i < count; i++) {
      const s = data[ch.pos + i] & 0xff;
      const o = (offset + i) * 2;
      pb[o] += lscale[s];
      pb[o + 1] += rscale[s];
    }
    ch.pos += count;
  }

  /** S_PaintChannelFrom16 */
  private paintChannelFrom16(ch: Channel, sc: SfxCache, count: number, offset: number, sndVol: number): void {
    const leftvol = Math.imul(ch.leftvol, sndVol);
    const rightvol = Math.imul(ch.rightvol, sndVol);
    const data = sc.data;
    const pb = this.paintbuffer;
    for (let i = 0; i < count; i++) {
      const s = data[ch.pos + i];
      const o = (offset + i) * 2;
      pb[o] += Math.imul(s, leftvol) >> 8;
      pb[o + 1] += Math.imul(s, rightvol) >> 8;
    }
    ch.pos += count;
  }

  /** S_TransferStereo16 and S_WriteLinearBlastStereo16: into the ring, clamped to 16 bits. */
  private transferStereo16(endtime: number): void {
    const dma = this.dma!;
    const out = dma.buffer;
    const mask = (dma.samples >> 1) - 1;
    const pb = this.paintbuffer;
    for (let t = this.paintedtime, k = 0; t < endtime; t++, k += 2) {
      const pos = (t & mask) * 2;
      out[pos] = clamp16(pb[k] >> 8);
      out[pos + 1] = clamp16(pb[k + 1] >> 8);
    }
  }
}

const clamp16 = (v: number) => (v > 0x7fff ? 0x7fff : v < -0x8000 ? -0x8000 : v);


/** wavinfo_t */
export interface WavInfo {
  rate: number;
  width: number;
  channels: number;
  loopstart: number;
  samples: number;
  dataofs: number;
}

/**
 * GetWavinfo: the RIFF chunks a WAV must have, and a cue chunk's loop start (with a LIST chunk's
 * "mark" length, as cooledit wrote it). Missing chunks give an empty info, as the C's printf-and-return.
 */
export function getWavinfo(name: string, wav: Uint8Array): WavInfo {
  const info: WavInfo = { rate: 0, width: 0, channels: 0, loopstart: 0, samples: 0, dataofs: 0 };
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const end = wav.byteLength;
  const tag = (at: number, s: string) => at + 4 <= end && String.fromCharCode(wav[at], wav[at + 1], wav[at + 2], wav[at + 3]) === s;
  let iffData = 0;
  let lastChunk = 0;
  let p: number | null = 0;
  const findNextChunk = (s: string) => {
    for (;;) {
      p = lastChunk;
      if (p >= end) {
        p = null; // didn't find the chunk
        return;
      }
      const len = p + 8 <= end ? view.getInt32(p + 4, true) : -1;
      if (len < 0) {
        p = null;
        return;
      }
      lastChunk = p + 8 + ((len + 1) & ~1);
      if (tag(p, s)) return;
    }
  };
  const findChunk = (s: string) => {
    lastChunk = iffData;
    findNextChunk(s);
  };
  findChunk('RIFF');
  if (!(p !== null && tag(p + 8, 'WAVE'))) return info; // Missing RIFF/WAVE chunks
  iffData = p + 12;
  findChunk('fmt ');
  if (p === null) return info;
  let at: number = p + 8;
  const format = view.getInt16(at, true);
  if (format !== 1) return info; // Microsoft PCM format only
  info.channels = view.getInt16(at + 2, true);
  info.rate = view.getInt32(at + 4, true);
  at += 8 + 4 + 2; // past the format, the channels, the rate, the byte rate and the block align
  info.width = Math.trunc(view.getInt16(at, true) / 8);
  findChunk('cue ');
  if (p !== null) {
    info.loopstart = view.getInt32(p + 32, true);
    // if the next chunk is a LIST chunk, look for a cue length marker
    findNextChunk('LIST');
    if (p !== null && tag(p + 28, 'mark')) {
      // this is not a proper parse, but it works with cooledit...
      info.samples = info.loopstart + view.getInt32(p + 24, true);
    }
  } else {
    info.loopstart = -1;
  }
  findChunk('data');
  if (p === null) return info; // Missing data chunk
  const samples = Math.trunc(view.getInt32(p + 4, true) / info.width);
  if (info.samples) {
    if (samples < info.samples) throw new Error(`Sound ${name} has a bad loop length`);
  } else {
    info.samples = samples;
  }
  info.dataofs = p + 8;
  return info;
}
