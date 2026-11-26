// Web Worker for BSP parsing
import { parseBspData } from './bsp.js';

self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const buffer = event.data;
    const data = parseBspData(buffer);
    // Transfer the buffer back to avoid copy, though we already parsed it.
    // The BspData contains many small objects, structured clone will handle them.
    // We can't easily transfer the typed arrays inside BspData because they are views on new buffers created during parse.
    // However, modern browsers are good at structured cloning.
    self.postMessage({ type: 'success', data });
  } catch (error) {
    self.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
    });
  }
};
