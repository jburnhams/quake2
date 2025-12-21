import { Canvas, Image } from '@napi-rs/canvas';
import fs from 'fs/promises';
import path from 'path';

export interface VisualDiff {
    diffPercentage: number;
    diffImage?: Buffer;
}

/**
 * Captures a screenshot of the game using Playwright.
 * @param page Playwright Page object
 * @param name Output filename (without extension)
 */
export async function captureGameScreenshot(page: any, name: string): Promise<Buffer> {
    return await page.screenshot({ path: `${name}.png` });
}

/**
 * Saves a canvas to a PNG file.
 * Compatible with both JSDOM/HTMLCanvasElement and @napi-rs/canvas.
 */
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

/**
 * Compares a canvas state against a baseline image file.
 * Returns true if they match (within optional threshold logic, currently strict pixel match).
 * If baseline does not exist, it saves the current state as baseline and returns true.
 */
export async function compareScreenshot(canvas: Canvas | HTMLCanvasElement, baselinePath: string): Promise<boolean> {
    try {
        await fs.access(baselinePath);
    } catch {
        // Baseline doesn't exist, save current as baseline
        console.warn(`Baseline not found at ${baselinePath}, saving current as baseline.`);
        await takeScreenshot(canvas, baselinePath);
        return true;
    }

    // Load baseline
    const baselineBuffer = await fs.readFile(baselinePath);
    const baselineImage = new Image();
    baselineImage.src = baselineBuffer;

    // Get dimensions (assume match for now, or fail)
    const width = baselineImage.width;
    const height = baselineImage.height;

    // Get current image data
    // We need to draw both to canvases to get pixel data easily with @napi-rs/canvas
    // If input is already a canvas, we can use it.

    // Helper to get buffer from input canvas
    let currentBuffer: Buffer;
    if ('toBuffer' in canvas && typeof canvas.toBuffer === 'function') {
        currentBuffer = canvas.toBuffer('image/png');
    } else if ('toDataURL' in canvas) {
        const dataUrl = canvas.toDataURL('image/png');
        currentBuffer = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
    } else {
        throw new Error('Unsupported canvas type');
    }

    // Simple Buffer comparison first (fastest)
    if (baselineBuffer.equals(currentBuffer)) {
        return true;
    }

    // If buffers differ, it could be metadata or compression. Do pixel check.
    // Note: Creating a new canvas to draw the image onto for pixel access
    // This requires the 'Canvas' constructor which we imported.
    const baselineCanvas = new Canvas(width, height);
    const ctx = baselineCanvas.getContext('2d');
    ctx.drawImage(baselineImage, 0, 0);
    const baselineData = ctx.getImageData(0, 0, width, height).data;

    // Load current buffer to image to draw (handles JSDOM/napi differences uniformally)
    const currentImage = new Image();
    currentImage.src = currentBuffer;

    if (currentImage.width !== width || currentImage.height !== height) {
        console.error(`Dimension mismatch: Baseline ${width}x${height} vs Current ${currentImage.width}x${currentImage.height}`);
        return false;
    }

    const currentCanvas = new Canvas(width, height);
    const ctx2 = currentCanvas.getContext('2d');
    ctx2.drawImage(currentImage, 0, 0);
    const currentData = ctx2.getImageData(0, 0, width, height).data;

    let diffPixels = 0;
    const totalPixels = width * height;

    // Simple pixel diff
    for (let i = 0; i < baselineData.length; i += 4) {
        if (baselineData[i] !== currentData[i] ||         // R
            baselineData[i+1] !== currentData[i+1] ||     // G
            baselineData[i+2] !== currentData[i+2] ||     // B
            baselineData[i+3] !== currentData[i+3]) {     // A
            diffPixels++;
        }
    }

    if (diffPixels > 0) {
        console.error(`Visual regression: ${diffPixels} pixels differ (${(diffPixels/totalPixels*100).toFixed(2)}%)`);
        // Save diff image? (Optional, skipping for now)
        return false;
    }

    return true;
}

/**
 * Compares two screenshots (Buffers).
 * Uses simple buffer check. Kept for backward compatibility or direct buffer comparison.
 */
export function compareScreenshots(baseline: Buffer, current: Buffer, threshold: number = 0.01): VisualDiff {
    // Basic length check first
    if (baseline.length !== current.length) {
        return { diffPercentage: 1.0 };
    }

    let diffPixels = 0;
    const totalPixels = baseline.length; // Approximate bytes

    for (let i = 0; i < baseline.length; i++) {
        if (baseline[i] !== current[i]) {
            diffPixels++;
        }
    }

    const diffPercentage = diffPixels / totalPixels;

    return {
        diffPercentage,
    };
}

export interface VisualScenario {
    sceneName: string;
    setup: () => Promise<void>;
}

/**
 * Creates a visual test scenario.
 */
export function createVisualTestScenario(sceneName: string): VisualScenario {
    return {
        sceneName,
        setup: async () => {
            // Setup scene logic
        }
    };
}
