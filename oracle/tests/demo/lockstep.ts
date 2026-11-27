/**
 * Demo lockstep: id's Quake 2 (oracle/build/q2demo, see ../../demo/demo_harness.c) plays a demo and
 * writes, frame by frame, what its client read and what it drew and played; the TS client is given
 * the same messages, clock and network sequence numbers, and its output is compared layer by layer.
 * Each layer reports the first frame it differs on, with the field and both values, so a report
 * reads like "view: frame 412, vieworg[2], C -191.9375, TS -192".
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PakArchive } from '@quake2ts/engine';
import { OriginalClient, type RefDef, type RefEntity } from '../../../packages/client/src/cl/client';
import { virtualDevice } from '../../../packages/client/src/cl/snd';

export const ORACLE_DIR = resolve(__dirname, '../..');
export const REPO_ROOT = resolve(ORACLE_DIR, '..');
export const DEMO_PAK_DIR = join(REPO_ROOT, '.paks');
export const DEMO_PAK = join(DEMO_PAK_DIR, 'baseq2', 'pak0.pak');

/** One line of demo.jsonl. */
type Line = { t: string; f: number; [key: string]: any };

export interface CFrame {
  f: number;
  msgs: { ack: number; data: Uint8Array }[];
  frame?: Line;
  ref?: Line;
  draw?: Line;
  chan?: Line;
  /** A frame before the client was active: its msec and the virtual clock. */
  tick?: Line;
  snds: Line[];
}

/** Runs q2demo (unless Q2DEMO_OUT names a finished run) and groups its output by client frame. */
export function runCDemo(options: { msec?: number; shotEvery?: number } = {}): { dir: string; frames: CFrame[] } {
  let dir = process.env.Q2DEMO_OUT;
  if (!dir) {
    const bin = process.env.Q2DEMO_BIN ?? join(ORACLE_DIR, 'build', 'q2demo');
    if (!existsSync(bin)) throw new Error(`${bin} is not built (oracle/demo/build.sh; needs OSMesa)`);
    dir = mkdtempSync(join(tmpdir(), 'q2demo-'));
    execFileSync(bin, [DEMO_PAK_DIR, dir, String(options.msec ?? 25), String(options.shotEvery ?? 0)], { stdio: 'pipe' });
  }
  return { dir, frames: readCDemo(join(dir, 'demo.jsonl')) };
}

export function readCDemo(file: string): CFrame[] {
  const frames: CFrame[] = [];
  const at = (f: number) => (frames[f] ??= { f, msgs: [], snds: [] });
  for (const text of readFileSync(file, 'utf8').split('\n')) {
    if (!text) continue;
    const line = JSON.parse(text) as Line;
    const frame = at(line.f);
    if (line.t === 'msg') frame.msgs.push({ ack: line.ack, data: Buffer.from(line.hex, 'hex') });
    else if (line.t === 'snd') frame.snds.push(line);
    else (frame as any)[line.t] = line;
  }
  for (let i = 0; i < frames.length; i++) at(i);
  return frames;
}

/** What ref_gl would load, from the pak's directory. */
export function pakAssets(pakPath = DEMO_PAK) {
  const buf = readFileSync(pakPath);
  const pak = PakArchive.fromArrayBuffer('pak0.pak', buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  const has = (name: string) => pak.getEntry(name.replace(/^\//, '')) !== undefined;
  return {
    hasModel: has,
    hasSkin: has,
    // a pic name that starts with a slash is a path; otherwise pics/<name>.pcx
    hasPic: (name: string) => (name.startsWith('/') || name.startsWith('\\') ? has(name.slice(1)) : has(`pics/${name}.pcx`)),
    loadFile: (name: string) => (has(name) ? pak.readFile(name) : null),
  };
}

export interface Divergence {
  frame: number;
  field: string;
  c: unknown;
  ts: unknown;
}

export interface LayerResult {
  layer: string;
  /** Frames this layer was compared on. */
  compared: number;
  first: Divergence | null;
  /** Frames that differ, of `compared`. */
  differing: number;
  /** For the list layers, how many entries the C drew over all frames (so a pass is not an empty one). */
  items: number;
  /** What the items and the compared units are called in the report. */
  units?: { items: string; compared: string };
}

const F = Math.fround;

/** Compares a C float (printed %.9g) with a TS float32. */
function sameFloat(c: number | null, ts: number): boolean {
  if (c === null) return Number.isNaN(ts);
  return F(c) === ts || (Object.is(F(c), 0) && ts === 0);
}

function diffFloats(prefix: string, c: number[], ts: readonly number[]): string | null {
  for (let i = 0; i < c.length; i++) if (!sameFloat(c[i], ts[i])) return `${prefix}[${i}]`;
  return null;
}

/** A refdef entity as one comparable string (the C sorts its list by model and skin pointers). */
function entityKey(e: { model: string | null; frame: number; oldframe: number; backlerp: number; origin: number[]; oldorigin: number[]; angles: number[]; skinnum: number; skin: string | null; flags: number; lightstyle: number; alpha: number }): string {
  const n = (v: number) => F(v).toString();
  return [e.model, e.frame, e.oldframe, n(e.backlerp), e.origin.map(n).join(' '), e.oldorigin.map(n).join(' '), e.angles.map(n).join(' '), e.skinnum, e.skin, e.flags, e.lightstyle, n(e.alpha)].join('|');
}

class Layer {
  result: LayerResult;
  constructor(name: string, units?: { items: string; compared: string }) {
    this.result = { layer: name, compared: 0, first: null, differing: 0, items: 0, units };
  }
  check(frame: number, field: string | null, c: unknown, ts: unknown, items = 0) {
    this.result.compared++;
    this.result.items += items;
    if (field === null) return;
    this.result.differing++;
    this.result.first ??= { frame, field, c, ts };
  }
}

export interface LockstepReport {
  layers: LayerResult[];
  framesRun: number;
}

/** Plays the C run's inputs through the TS client and compares what each drew. */
export function lockstep(frames: CFrame[], pcm?: Int16Array): LockstepReport {
  // the harness's sound device: the "hardware" plays at the virtual clock, 22,050 Hz, 16-bit stereo
  let clock = 0;
  const device = virtualDevice(() => clock);
  const client = new OriginalClient({ assets: pakAssets(), soundDevice: device, sound: { loadas8bit: true } });
  const mixed: number[] = [];
  let written = 0;
  const timing = new Layer('timing (cl.time, lerpfrac)');
  const state = new Layer('frame state (cl.frame, player state, entities)');
  const prediction = new Layer('prediction');
  const view = new Layer('view (refdef origin, angles, fov, blend, flags, areas)');
  const styles = new Layer('light styles');
  const entities = new Layer('entity list');
  const dlights = new Layer('dynamic lights');
  const particles = new Layer('particles');
  const sounds = new Layer('sound starts', { items: 'started', compared: 'frames' });
  const channels = new Layer('sound channels', { items: 'channel-frames playing', compared: 'frames' });

  const msec = frames.find((f) => f.frame)?.frame?.msec ?? 25;
  let framesRun = 0;
  let cStyles: number[][] | null = null;

  for (const cf of frames) {
    const cl = cf.frame;
    clock = cl?.clock ?? cf.tick?.clock ?? clock;
    const out = client.runFrame({
      msec: cl?.msec ?? cf.tick?.msec ?? msec,
      realtime: cl?.realtime ?? 0,
      messages: cf.msgs,
      ack: cl?.ack ?? 0,
      seq: cl?.seq ?? 0,
    });
    {
      // S_StartSound and S_StartLocalSound calls, in order, whether or not a frame was drawn
      const n = (v: number) => F(v).toString();
      const c = cf.snds.map((s) => (s.local !== undefined ? `local ${s.local}` : [s.ent, s.ch, s.sfx, n(s.vol), n(s.attn), n(s.ofs), s.org ? s.org.map(n).join(' ') : '-'].join('|')));
      const ts = (out.ran ? client.sounds : []).map((s) => (s.local ? `local ${s.name}` : [s.ent, s.channel, s.name, n(s.volume), n(s.attenuation), n(s.timeofs), s.origin ? s.origin.map(n).join(' ') : '-'].join('|')));
      const i = firstDiff(c, ts);
      sounds.check(cf.f, i < 0 ? null : c.length !== ts.length ? `count ${c.length} vs ${ts.length}, first differing ${i}` : `sound ${i}`, i < 0 ? null : c[i], i < 0 ? null : ts[i], c.length);
    }
    if (!cl) continue;
    framesRun++;
    const f = cf.f;

    // timing
    timing.check(f, !out.ran ? 'ran' : cl.time !== client.time ? 'time' : !sameFloat(cl.lerp, client.lerpfrac) ? 'lerpfrac' : null,
      cl.time + ' / ' + cl.lerp, client.time + ' / ' + client.lerpfrac);

    // frame state
    {
      const fr = client.frame;
      const ps = fr.playerstate;
      const cps = cl.ps;
      let field: string | null = null;
      let c: unknown;
      let ts: unknown;
      const pairs: [string, unknown, unknown][] = [
        ['serverframe', cl.serverframe, fr.serverframe],
        ['deltaframe', cl.deltaframe, fr.deltaframe],
        ['valid', !!cl.valid, fr.valid],
        ['pm_type', cps.pm_type, ps.pmove.pm_type],
        ['pm_flags', cps.pm_flags, ps.pmove.pm_flags],
        ['pm_time', cps.pm_time, ps.pmove.pm_time],
        ['gravity', cps.gravity, ps.pmove.gravity],
        ['gunindex', cps.gunindex, ps.gunindex],
        ['gunframe', cps.gunframe, ps.gunframe],
        ['rdflags', cps.rdflags, ps.rdflags],
        ['stats', cps.stats.join(), ps.stats.join()],
        ['origin', cps.origin.join(), ps.pmove.origin.join()],
        ['velocity', cps.velocity.join(), ps.pmove.velocity.join()],
        ['delta_angles', cps.delta_angles.join(), ps.pmove.delta_angles.join()],
      ];
      for (const [name, a, b] of pairs) if (a !== b) { field = name; c = a; ts = b; break; }
      if (!field) {
        for (const [name, a, b] of [['viewangles', cps.viewangles, ps.viewangles], ['viewoffset', cps.viewoffset, ps.viewoffset], ['kick_angles', cps.kick_angles, ps.kick_angles], ['gunangles', cps.gunangles, ps.gunangles], ['gunoffset', cps.gunoffset, ps.gunoffset], ['blend', cps.blend, ps.blend], ['fov', [cps.fov], [ps.fov]]] as [string, number[], number[]][]) {
          const d = diffFloats(name, a, b);
          if (d) { field = d; c = a; ts = b; break; }
        }
      }
      if (!field) {
        const tsEnts: string[] = [];
        for (let i = 0; i < fr.num_entities; i++) {
          const s = client.parseEntities[(fr.parse_entities + i) & 1023];
          tsEnts.push(JSON.stringify([s.number, s.origin.map(F), s.angles.map(F), s.old_origin.map(F), [s.modelindex, s.modelindex2, s.modelindex3, s.modelindex4], s.frame, s.skinnum, s.effects >>> 0, s.renderfx, s.solid, s.sound, s.event]));
        }
        const cEnts = (cl.ents as any[]).map((s) => JSON.stringify([s.n, s.origin.map(F), s.angles.map(F), s.old_origin.map(F), s.model, s.frame, s.skin, s.effects >>> 0, s.renderfx, s.solid, s.sound, s.event]));
        for (let i = 0; i < Math.max(cEnts.length, tsEnts.length); i++) {
          if (cEnts[i] !== tsEnts[i]) { field = `entity #${i}`; c = cEnts[i]; ts = tsEnts[i]; break; }
        }
      }
      state.check(f, field, c, ts);
    }

    // prediction
    {
      const p = cl.pred;
      const field = diffFloats('origin', p.origin, client.predictedOrigin)
        ?? diffFloats('error', p.error, client.predictionError)
        ?? (!sameFloat(p.step, client.predictedStep) ? 'step' : null)
        ?? (p.steptime !== client.predictedStepTime ? 'steptime' : null);
      prediction.check(f, field, p, { origin: client.predictedOrigin, error: client.predictionError, step: client.predictedStep, steptime: client.predictedStepTime });
    }

    // the mixer's channels after S_Update, and the samples it painted (the harness's flush_pcm)
    if (out.ran && client.state === 'active') {
      const snd = client.snd;
      const c = cf.chan;
      const ts = {
        soundtime: snd.soundtime,
        painted: snd.paintedtime,
        c: snd.channels.flatMap((ch, i) => (ch.sfx ? [[i, ch.sfx.name, ch.leftvol, ch.rightvol, ch.end, ch.pos, ch.entnum, ch.entchannel, ch.master_vol, ch.fixed_origin ? 1 : 0, ch.autosound ? 1 : 0, F(ch.dist_mult), ch.origin.map(F).join(' ')].join('|')] : [])),
      };
      let field: string | null = null;
      let cv: unknown = c;
      let tv: unknown = ts;
      if (!c) field = 'no C channels line';
      else {
        const cc = (c.c as any[]).map((h) => [h.i, h.sfx, h.left, h.right, h.end, h.pos, h.ent, h.ch, h.master, h.fixed, h.auto, F(h.dist), h.origin.map(F).join(' ')].join('|'));
        if (c.soundtime !== ts.soundtime) [field, cv, tv] = ['soundtime', c.soundtime, ts.soundtime];
        else if (c.painted !== ts.painted) [field, cv, tv] = ['paintedtime', c.painted, ts.painted];
        else if (diffFloats('listener', c.listener.flat(), [...snd.listener_origin, ...snd.listener_forward, ...snd.listener_right, ...snd.listener_up])) [field, cv, tv] = ['listener', c.listener, [snd.listener_origin, snd.listener_forward, snd.listener_right, snd.listener_up]];
        else {
          const i = firstDiff(cc, ts.c);
          if (i >= 0) [field, cv, tv] = [cc.length !== ts.c.length ? `count ${cc.length} vs ${ts.c.length}, first differing ${i}` : `channel ${i}`, cc[i], ts.c[i]];
        }
        channels.check(cf.f, field, cv, tv, cc.length);
      }
      if (!c) channels.check(cf.f, field, cv, tv);
      if (pcm) {
        const buf = device.buffer;
        const mask = (device.samples >> 1) - 1;
        for (; written < snd.paintedtime; written++) mixed.push(buf[(written & mask) * 2], buf[(written & mask) * 2 + 1]);
      }
    }

    const cr = cf.ref;
    const rd = out.refdef;
    if (!cr && !rd) continue;
    if (!cr || !rd) {
      view.check(f, 'drawn', !!cr, !!rd);
      continue;
    }
    compareRefdef(f, cr, rd, view, styles, entities, dlights, particles, (s) => (cStyles = s ?? cStyles), () => cStyles);
  }

  const layers = [timing, state, prediction, view, styles, entities, dlights, particles, sounds, channels];
  if (pcm) {
    // the mixed audio, sample for sample (left and right interleaved), at 22,050 pairs a second
    const audio = new Layer('mixed audio', { items: 'in the C run', compared: 'stereo samples' });
    const n = Math.max(pcm.length, mixed.length);
    let first = -1;
    let differing = 0;
    for (let i = 0; i < n; i++) if (pcm[i] !== mixed[i]) { differing++; if (first < 0) first = i; }
    audio.result = {
      ...audio.result, compared: n >> 1, differing: differing, items: pcm.length >> 1,
      first: first < 0 ? null : { frame: -1, field: `sample ${first >> 1} (${(first >> 1) / 22050} s), ${first & 1 ? 'right' : 'left'}; ${pcm.length} vs ${mixed.length} values`, c: Array.from(pcm.subarray(first, first + 8)), ts: mixed.slice(first, first + 8) },
    };
    layers.push(audio);
  }
  return { framesRun, layers: layers.map((l) => l.result) };
}

function compareRefdef(
  f: number, cr: Line, rd: RefDef,
  view: Layer, styles: Layer, entities: Layer, dlights: Layer, particles: Layer,
  setStyles: (s: number[][] | undefined) => void, getStyles: () => number[][] | null,
) {
  {
    let field: string | null = null;
    if (cr.x !== rd.x || cr.y !== rd.y || cr.w !== rd.width || cr.h !== rd.height) field = 'rect';
    field ??= diffFloats('fov', cr.fov, [rd.fov_x, rd.fov_y])
      ?? diffFloats('vieworg', cr.org, rd.vieworg)
      ?? diffFloats('viewangles', cr.ang, rd.viewangles)
      ?? diffFloats('blend', cr.blend, rd.blend)
      ?? (!sameFloat(cr.time, rd.time) ? 'time' : null)
      ?? (cr.rdflags !== rd.rdflags ? 'rdflags' : null);
    if (!field && cr.areas !== undefined) {
      const ts = rd.areabits ? Buffer.from(rd.areabits.subarray(0, 32)).toString('hex') : '';
      if (ts !== cr.areas) field = 'areabits';
    }
    view.check(f, field, { org: cr.org, ang: cr.ang, fov: cr.fov, blend: cr.blend, time: cr.time }, { org: rd.vieworg, ang: rd.viewangles, fov: [rd.fov_x, rd.fov_y], blend: rd.blend, time: rd.time });
  }
  {
    setStyles(cr.styles);
    const c = getStyles();
    let field: string | null = null;
    if (c) for (let i = 0; i < c.length && !field; i++) field = diffFloats(`style ${i}`, c[i], rd.lightstyles[i]?.rgb ?? []);
    styles.check(f, field, field && c ? c[Number(field.split(' ')[1].split('[')[0])] : null, field ? rd.lightstyles[Number(field.split(' ')[1].split('[')[0])]?.rgb : null);
  }
  {
    // V_RenderView sorts the entities by their entity_t pointers, so the order is the C's memory layout
    const key = (e: any) => entityKey(e);
    const c = (cr.ents as any[]).map(key).sort();
    const ts = rd.entities.map((e: RefEntity) => key(e)).sort();
    let field: string | null = null;
    let cv: unknown = c.length;
    let tv: unknown = ts.length;
    for (let i = 0; i < Math.max(c.length, ts.length); i++) {
      if (c[i] !== ts[i]) {
        field = c.length !== ts.length ? `count ${c.length} vs ${ts.length}` : `entity ${i}`;
        const missing = c.filter((k) => !ts.includes(k));
        const extra = ts.filter((k) => !c.includes(k));
        cv = missing;
        tv = extra;
        break;
      }
    }
    entities.check(f, field, cv, tv, c.length);
  }
  {
    // in order: r_dlights is a list, and ref_gl lights the world in that order
    const c = (cr.dlights as any[]).map((l) => [...l.origin, ...l.color, l.intensity].map(F).join(' '));
    const ts = rd.dlights.map((l) => [...l.origin, ...l.color, l.intensity].map(F).join(' '));
    const i = firstDiff(c, ts);
    dlights.check(f, i < 0 ? null : c.length !== ts.length ? `count ${c.length} vs ${ts.length}` : `light ${i}`, i < 0 ? null : c[i] ?? c.length, i < 0 ? null : ts[i] ?? ts.length, c.length);
  }
  {
    // in order: CL_AddParticles walks the active list from its head
    const c = (cr.particles as number[][]).map((p) => p.map(F).join(' '));
    const ts = rd.particles.map((p) => [...p.origin, p.color, p.alpha].map(F).join(' '));
    const i = firstDiff(c, ts);
    particles.check(f, i < 0 ? null : c.length !== ts.length ? `count ${c.length} vs ${ts.length}, first differing ${i}` : `particle ${i}`, i < 0 ? null : c[i], i < 0 ? null : ts[i], c.length);
  }
}

function firstDiff(a: string[], b: string[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return i;
  return -1;
}

/** One line per layer, for a test's output. */
export function formatReport(report: LockstepReport): string {
  return report.layers.map((l) => {
    const units = l.units ?? { items: 'drawn', compared: 'frames' };
    const items = l.items ? `, ${l.items} ${units.items}` : '';
    if (!l.first) return `  ok    ${l.layer}: ${l.compared} ${units.compared}${items}`;
    const show = (v: unknown) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s && s.length > 400 ? s.slice(0, 400) + '…' : s; };
    const at = l.first.frame < 0 ? '' : `frame ${l.first.frame}, `;
    return `  DIFF  ${l.layer}: ${l.differing} of ${l.compared} ${units.compared}; first at ${at}${l.first.field}\n          C:  ${show(l.first.c)}\n          TS: ${show(l.first.ts)}`;
  }).join('\n');
}
