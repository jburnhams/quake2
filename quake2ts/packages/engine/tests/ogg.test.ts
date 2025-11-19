import { describe, expect, it } from 'vitest';
import { decodeOgg, OggDecodeError } from '../src/assets/ogg.js';
import type { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';

class StubDecoder implements Partial<OggVorbisDecoder> {
  readonly ready = Promise.resolve();
  decode(): unknown {
    return {
      channelData: [new Float32Array([0, 1, 0])],
      samplesDecoded: 3,
      sampleRate: 22050,
      bitDepth: 16,
      errors: [],
    };
  }
}

class ErrorDecoder implements Partial<OggVorbisDecoder> {
  readonly ready = Promise.resolve();
  decode(): unknown {
    return {
      channelData: [],
      samplesDecoded: 0,
      sampleRate: 0,
      bitDepth: 0,
      errors: [{ message: 'decode failed' }],
    };
  }
}

describe('OGG loader', () => {
  it('decodes via injected decoder', async () => {
    const audio = await decodeOgg(new Uint8Array([1, 2, 3]).buffer, new StubDecoder() as OggVorbisDecoder);
    expect(audio.sampleRate).toBe(22050);
    expect(audio.channelData[0]).toHaveLength(3);
  });

  it('throws on decoder errors', async () => {
    await expect(decodeOgg(new ArrayBuffer(0), new ErrorDecoder() as OggVorbisDecoder)).rejects.toBeInstanceOf(OggDecodeError);
  });
});
