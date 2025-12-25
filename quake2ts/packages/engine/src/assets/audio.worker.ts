// Web Worker for Audio parsing
import { parseWav } from './wav.js';

const ctx: Worker = self as any;

interface AudioWorkerRequest {
    id: number;
    buffer: ArrayBuffer;
    type: string;
}

interface AudioWorkerResponse {
    id: number;
    type: 'success' | 'error';
    data?: any;
    message?: string;
}

ctx.onmessage = (event: MessageEvent<AudioWorkerRequest>) => {
  try {
    const { buffer, type, id } = event.data;
    if (type === 'wav') {
        const wav = parseWav(buffer);
        // We need to transfer channel data separately if we want zero-copy,
        // but parseWav returns a single interleaved array or structured object.
        // Actually parseWav returns { sampleRate, channels, bitsPerSample, samples: Float32Array }
        // The samples array can be transferred.
        ctx.postMessage({ id, type: 'success', data: wav } as AudioWorkerResponse, [wav.samples.buffer]);
    } else {
        throw new Error(`Unknown audio type: ${type}`);
    }
  } catch (error) {
    ctx.postMessage({
        id: event.data.id,
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
    } as AudioWorkerResponse);
  }
};
