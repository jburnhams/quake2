export interface WavData {
  readonly sampleRate: number;
  readonly channels: number;
  readonly bitsPerSample: number;
  readonly samples: Float32Array;
}

export class WavParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WavParseError';
  }
}

function readString(view: DataView, offset: number, length: number): string {
  return new TextDecoder('ascii').decode(new Uint8Array(view.buffer, view.byteOffset + offset, length));
}

export function parseWav(buffer: ArrayBuffer): WavData {
  if (buffer.byteLength < 44) {
    throw new WavParseError('WAV buffer too small');
  }

  const view = new DataView(buffer);
  if (readString(view, 0, 4) !== 'RIFF' || readString(view, 8, 4) !== 'WAVE') {
    throw new WavParseError('Invalid WAV header');
  }

  let offset = 12;
  let fmtOffset = -1;
  let dataOffset = -1;
  let fmtSize = 0;
  let dataSize = 0;

  while (offset + 8 <= buffer.byteLength) {
    const chunkId = readString(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkId === 'fmt ') {
      fmtOffset = chunkDataOffset;
      fmtSize = chunkSize;
    } else if (chunkId === 'data') {
      dataOffset = chunkDataOffset;
      dataSize = chunkSize;
    }

    offset = chunkDataOffset + chunkSize;
  }

  if (fmtOffset === -1 || dataOffset === -1) {
    throw new WavParseError('Missing fmt or data chunk');
  }

  const audioFormat = view.getUint16(fmtOffset, true);
  const channels = view.getUint16(fmtOffset + 2, true);
  const sampleRate = view.getUint32(fmtOffset + 4, true);
  const bitsPerSample = view.getUint16(fmtOffset + 14, true);

  if (audioFormat !== 1) {
    throw new WavParseError('Only PCM WAV is supported');
  }

  const bytesPerSample = bitsPerSample / 8;
  const frameCount = dataSize / (bytesPerSample * channels);
  const samples = new Float32Array(frameCount * channels);

  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let ch = 0; ch < channels; ch += 1) {
      const sampleIndex = frame * channels + ch;
      const byteOffset = dataOffset + sampleIndex * bytesPerSample;
      let value = 0;
      if (bitsPerSample === 8) {
        value = view.getUint8(byteOffset);
        samples[sampleIndex] = (value - 128) / 128;
      } else if (bitsPerSample === 16) {
        value = view.getInt16(byteOffset, true);
        samples[sampleIndex] = value / 32768;
      } else if (bitsPerSample === 24) {
        const b0 = view.getUint8(byteOffset);
        const b1 = view.getUint8(byteOffset + 1);
        const b2 = view.getInt8(byteOffset + 2);
        value = b0 | (b1 << 8) | (b2 << 16);
        samples[sampleIndex] = value / 8388608;
      } else {
        throw new WavParseError(`Unsupported bitsPerSample: ${bitsPerSample}`);
      }
    }
  }

  return { sampleRate, channels, bitsPerSample, samples };
}
