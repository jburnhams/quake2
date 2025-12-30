import { describe, expect, it } from 'vitest';
import { parseWav, WavParseError } from '../src/assets/wav.js';
import { buildWav } from '@quake2ts/test-utils'; // wavBuilder.js';

describe('WAV loader', () => {
  it('decodes PCM samples to float data', () => {
    const wavBuffer = buildWav({ sampleRate: 22050, channels: 1, samples: [0, 0.5, -0.5] });
    const wav = parseWav(wavBuffer);
    expect(wav.sampleRate).toBe(22050);
    expect(wav.samples[1]).toBeCloseTo(0.5, 3);
  });

  it('validates structure and rejects unsupported formats', () => {
    const wavBuffer = buildWav({ sampleRate: 44100, channels: 1, samples: [0] });
    const view = new DataView(wavBuffer);
    view.setUint8(0, 0x00);
    expect(() => parseWav(wavBuffer)).toThrow(WavParseError);
  });
});
