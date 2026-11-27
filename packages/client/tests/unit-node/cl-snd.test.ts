import { describe, expect, it } from 'vitest';
import { ClientSound, getWavinfo, virtualDevice, type SoundHost } from '../../src/cl/snd.js';

// The port of id's snd_dma.c, snd_mem.c and snd_mix.c. The demo lockstep (oracle/tests) holds it to
// id's own, sample for sample; these check the pieces a lockstep run cannot reach on its own.

/** A mono WAV of `samples`, 8- or 16-bit, with a cue point when `loopstart` is given. */
function wav(samples: number[], width: 1 | 2, rate = 22050, loopstart?: number): Uint8Array {
  const data = new Uint8Array(samples.length * width);
  const dv = new DataView(data.buffer);
  samples.forEach((s, i) => (width === 2 ? dv.setInt16(i * 2, s, true) : dv.setUint8(i, s + 128)));
  const chunks: [string, Uint8Array][] = [];
  const fmt = new DataView(new ArrayBuffer(16));
  fmt.setInt16(0, 1, true);
  fmt.setInt16(2, 1, true);
  fmt.setInt32(4, rate, true);
  fmt.setInt32(8, rate * width, true);
  fmt.setInt16(12, width, true);
  fmt.setInt16(14, width * 8, true);
  chunks.push(['fmt ', new Uint8Array(fmt.buffer)]);
  if (loopstart !== undefined) {
    const cue = new DataView(new ArrayBuffer(28));
    cue.setInt32(0, 1, true);
    cue.setInt32(24, loopstart, true); // the C reads it 32 bytes into the chunk, header included
    chunks.push(['cue ', new Uint8Array(cue.buffer)]);
  }
  chunks.push(['data', data]);
  const body = chunks.reduce((n, [, b]) => n + 8 + b.length + (b.length & 1), 4);
  const out = new Uint8Array(8 + body);
  const ov = new DataView(out.buffer);
  const tag = (at: number, s: string) => [...s].forEach((c, i) => (out[at + i] = c.charCodeAt(0)));
  tag(0, 'RIFF');
  ov.setInt32(4, body, true);
  tag(8, 'WAVE');
  let at = 12;
  for (const [name, b] of chunks) {
    tag(at, name);
    ov.setInt32(at + 4, b.length, true);
    out.set(b, at + 8);
    at += 8 + b.length + (b.length & 1);
  }
  return out;
}

function setup(files: Record<string, Uint8Array>, options: { loadas8bit?: boolean } = {}) {
  let clock = 0;
  const device = virtualDevice(() => clock);
  const host: SoundHost = {
    active: true,
    disableScreen: false,
    soundPrepped: true,
    playernum: 0,
    servertime: 0,
    entityOrigin: () => [0, 0, 0],
    entityNumber: (n) => n,
    frameEntities: () => [],
    soundPrecache: () => null,
    configstring: () => '',
    loadFile: (path) => files[path] ?? null,
  };
  const snd = new ClientSound(host, device, options);
  const right: [number, number, number] = [0, -1, 0];
  const frame = (ms: number) => {
    clock += ms;
    snd.update([0, 0, 0], [1, 0, 0], right, [0, 0, 1]);
  };
  return { snd, device, frame };
}

const tone = Array.from({ length: 30000 }, (_, i) => Math.round(Math.sin(i / 5) * 20000));

describe('the client sound (snd_dma.c, snd_mem.c, snd_mix.c)', () => {
  it('reads a WAV as GetWavinfo does, with a cue chunk as its loop start', () => {
    expect(getWavinfo('a', wav(tone, 2))).toMatchObject({ rate: 22050, width: 2, channels: 1, loopstart: -1, samples: 30000, dataofs: 44 });
    expect(getWavinfo('b', wav(tone, 2, 22050, 100))).toMatchObject({ loopstart: 100, samples: 30000 });
  });

  it('resamples an 11 kHz sound to the device rate by 1/256 steps', () => {
    const { snd } = setup({ 'sound/a.wav': wav(tone.slice(0, 1000), 2, 11025) }, { loadas8bit: false });
    const sc = snd.loadSound(snd.registerSound('a.wav')!)!;
    expect(sc.length).toBe(2000);
    expect(sc.width).toBe(2);
    expect(sc.data[2]).toBe(tone[1]);
  });

  it('mixes an 8-bit sound at the volume row the shipped assembly picked (volume >> 3), not silence', () => {
    // snd_mix.c's C S_PaintChannelFrom8 takes row volume >> 11, always 0: silent. snd_mixa.s used >> 3.
    const { snd, device, frame } = setup({ 'sound/a.wav': wav(tone, 2) });
    snd.startSound(null, 1, 1, snd.registerSound('a.wav'), 1, 1, 0);
    frame(100);
    expect(snd.channels[0].sfx?.name).toBe('a.wav');
    expect(device.buffer.reduce((m, v) => Math.max(m, v), 0)).toBeGreaterThan(1000);
  });

  it('pans a sound to the side it is on and fades it with distance', () => {
    const { snd, frame } = setup({ 'sound/a.wav': wav(tone, 2) });
    snd.startSound([0, -200, 0], 5, 1, snd.registerSound('a.wav'), 1, 1, 0); // to the listener's right
    snd.startSound([0, 2000, 0], 6, 1, snd.registerSound('a.wav'), 1, 1, 0); // far to the left
    frame(100);
    // equal begins: the later is sorted in front of the earlier, so takes the first channel
    const [far, near] = snd.channels;
    expect([far.entnum, near.entnum]).toEqual([6, 5]);
    expect(near.rightvol).toBeGreaterThan(near.leftvol);
    expect(far.leftvol).toBeGreaterThan(far.rightvol);
    expect(far.leftvol).toBeLessThan(near.rightvol);
  });

  it('starts a sound with an offset at the server frame time plus the offset', () => {
    const { snd, frame } = setup({ 'sound/a.wav': wav(tone, 2) });
    frame(100);
    const painted = snd.paintedtime;
    snd.startSound(null, 1, 1, snd.registerSound('a.wav'), 1, 1, 0.05);
    frame(25); // the mixer is not yet 50 ms past where it had painted to
    expect(snd.channels.some((c) => c.sfx)).toBe(false);
    frame(100);
    const ch = snd.channels.find((c) => c.sfx)!;
    // it began 1,102 samples (0.05 s at 22,050 Hz) after the mixer's position when it was started
    expect(ch.end - 30000).toBe(painted + 1102);
  });

  it('frees the sounds a new map does not register, so the limit is per map', () => {
    const { snd } = setup({ 'sound/a.wav': wav(tone.slice(0, 10), 2) });
    for (let map = 0; map < 3; map++) {
      snd.beginRegistration();
      for (let i = 0; i < 200; i++) snd.registerSound(`m${map}/s${i}.wav`);
      snd.endRegistration();
    }
    snd.beginRegistration();
    expect(snd.registerSound('a.wav')).not.toBeNull();
    snd.endRegistration();
    expect(() => {
      for (let i = 0; i < 600; i++) snd.registerSound(`more/s${i}.wav`);
    }).toThrow('S_FindName: out of sfx_t');
  });

  it('does nothing without a device, as when SNDDMA_Init fails', () => {
    const snd = new ClientSound({} as SoundHost, null);
    expect(snd.registerSound('a.wav')).toBeNull();
    snd.update([0, 0, 0], [1, 0, 0], [0, -1, 0], [0, 0, 1]);
    expect(snd.started).toBe(false);
  });
});
