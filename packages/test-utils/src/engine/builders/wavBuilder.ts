interface WavOptions {
  readonly sampleRate: number;
  readonly channels: number;
  readonly samples: readonly number[];
  readonly bitsPerSample?: number;
}

export function buildWav(options: WavOptions): ArrayBuffer {
  const bitsPerSample = options.bitsPerSample ?? 16;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = options.samples.length / options.channels;
  const dataSize = frameCount * options.channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    new Uint8Array(buffer, offset, text.length).set(new TextEncoder().encode(text));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, options.channels, true);
  view.setUint32(24, options.sampleRate, true);
  view.setUint32(28, options.sampleRate * options.channels * bytesPerSample, true);
  view.setUint16(32, options.channels * bytesPerSample, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < options.samples.length; i += 1) {
    const sample = options.samples[i]!;
    if (bitsPerSample === 8) {
      view.setUint8(offset, Math.max(0, Math.min(255, Math.round(sample * 128 + 128))));
      offset += 1;
    } else if (bitsPerSample === 16) {
      view.setInt16(offset, Math.round(sample * 32767), true);
      offset += 2;
    } else {
      throw new Error('Unsupported bit depth for builder');
    }
  }

  return buffer;
}
