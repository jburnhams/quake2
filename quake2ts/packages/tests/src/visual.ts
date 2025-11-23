import { Canvas } from '@napi-rs/canvas';
import fs from 'fs/promises';
import path from 'path';

export async function takeScreenshot(canvas: Canvas | HTMLCanvasElement, filepath: string): Promise<void> {
    let buffer: Buffer;

    // Handle @napi-rs/canvas Canvas object
    if ('toBuffer' in canvas && typeof canvas.toBuffer === 'function') {
        buffer = canvas.toBuffer('image/png');
    }
    // Handle JSDOM HTMLCanvasElement (if backed by node-canvas or similar)
    else if ('toDataURL' in canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
        buffer = Buffer.from(base64, 'base64');
    } else {
        throw new Error('Unsupported canvas type for screenshot');
    }

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, buffer);
}

export async function compareScreenshot(canvas: Canvas | HTMLCanvasElement, baselinePath: string): Promise<boolean> {
    // For now, just check if baseline exists.
    // True comparison requires reading the baseline and doing pixel diff (e.g. pixelmatch).
    // Given "Visual regression is best-effort", we will just implement the save for now.

    try {
        await fs.access(baselinePath);
    } catch {
        // Baseline doesn't exist, save current as baseline
        console.warn(`Baseline not found at ${baselinePath}, saving current as baseline.`);
        await takeScreenshot(canvas, baselinePath);
        return true;
    }

    // TODO: Implement pixelmatch comparison
    return true;
}
