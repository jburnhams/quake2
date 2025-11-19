import { OggVorbisDecoder } from '@wasm-audio-decoders/ogg-vorbis';

export interface OggAudio {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitDepth: number;
  readonly channelData: readonly Float32Array[];
}

export class OggDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OggDecodeError';
  }
}

export async function decodeOgg(buffer: ArrayBuffer, decoder: OggVorbisDecoder = new OggVorbisDecoder()): Promise<OggAudio> {
  await decoder.ready;
  const result = await decoder.decode(new Uint8Array(buffer));

  const errors = (result as { errors?: { message: string }[] }).errors;
  if (errors && errors.length > 0) {
    throw new OggDecodeError(errors.map((err) => err.message).join('; '));
  }

  return {
    sampleRate: result.sampleRate,
    channels: result.channelData.length,
    bitDepth: result.bitDepth,
    channelData: result.channelData,
  };
}
