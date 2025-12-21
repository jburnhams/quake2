import { takeScreenshot as takeScreenshotUtil, compareScreenshot as compareScreenshotUtil } from '@quake2ts/test-utils';
import type { Canvas } from '@napi-rs/canvas';

/**
 * Saves a canvas to a PNG file.
 * @deprecated Use takeScreenshot from @quake2ts/test-utils
 */
export async function takeScreenshot(canvas: Canvas | HTMLCanvasElement, filepath: string): Promise<void> {
    return takeScreenshotUtil(canvas, filepath);
}

/**
 * Compares a canvas state against a baseline image file.
 * @deprecated Use compareScreenshot from @quake2ts/test-utils
 */
export async function compareScreenshot(canvas: Canvas | HTMLCanvasElement, baselinePath: string): Promise<boolean> {
    return compareScreenshotUtil(canvas, baselinePath);
}
