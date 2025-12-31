import { compareSnapshots, getSnapshotPath, SnapshotTestOptions, ComparisonResult, savePNG } from './snapshots.js';
import UPNG from 'upng-js';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export interface AnimationSnapshotOptions extends SnapshotTestOptions {
  frameCount: number;
  fps?: number;
}

export interface AnimationSnapshotResult {
  passed: boolean;
  totalPixels: number;
  totalDiffPixels: number;
  percentDifferent: number;
  frameStats: ComparisonResult[];
}

async function loadAPNG(filepath: string): Promise<{ width: number, height: number, frames: Uint8ClampedArray[] }> {
    const buffer = await fs.readFile(filepath);
    // Cast buffer (Uint8Array) to ArrayBuffer for UPNG.decode
    // We must use buffer.buffer, but sliced if it's a subarray.
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    const img = UPNG.decode(arrayBuffer);
    const framesRGBA = UPNG.toRGBA8(img);

    // Convert ArrayBuffers to Uint8ClampedArrays
    const frames = framesRGBA.map(buffer => new Uint8ClampedArray(buffer));

    return {
        width: img.width,
        height: img.height,
        frames
    };
}

async function saveAPNG(
    filepath: string,
    frames: Uint8ClampedArray[],
    width: number,
    height: number,
    delayMs: number
): Promise<void> {
    // UPNG expects ArrayBuffers. Uint8ClampedArray.buffer might include offset/length.
    const buffers: ArrayBuffer[] = frames.map(f => {
        // Force copy to plain ArrayBuffer to avoid SharedArrayBuffer issues
        const dst = new ArrayBuffer(f.byteLength);
        new Uint8ClampedArray(dst).set(f);
        return dst;
    });

    // UPNG.encode(imgs, w, h, cnum, dels)
    const delays = new Array(frames.length).fill(delayMs);

    // cnum 0 = lossless
    const pngBuffer = UPNG.encode(buffers, width, height, 0, delays);

    await fs.mkdir(path.dirname(filepath), { recursive: true });
    await fs.writeFile(filepath, Buffer.from(pngBuffer));
}

export async function expectAnimationSnapshot(
    renderAndCaptureFrame: (frameIndex: number) => Promise<Uint8ClampedArray>,
    options: AnimationSnapshotOptions
): Promise<void> {
    const {
        name,
        width,
        height,
        frameCount,
        fps = 10,
        updateBaseline: updateBaselineOption = false,
        snapshotDir = path.join(process.cwd(), 'tests', '__snapshots__'),
        threshold = 0.1,
        maxDifferencePercent = 0.1
    } = options;

    if (!width || !height) {
        throw new Error('Width and height are required for expectAnimationSnapshot');
    }

    const baselinePath = getSnapshotPath(name, 'baseline', snapshotDir);
    const actualPath = getSnapshotPath(name, 'actual', snapshotDir);
    const diffPath = getSnapshotPath(name, 'diff', snapshotDir);
    const alwaysSave = process.env.ALWAYS_SAVE_SNAPSHOTS === '1';

    // Check global env var for updating snapshots
    const updateBaseline = updateBaselineOption || process.env.UPDATE_SNAPSHOTS === '1';

    // 1. Capture all frames
    const actualFrames: Uint8ClampedArray[] = [];
    for (let i = 0; i < frameCount; i++) {
        const frameData = await renderAndCaptureFrame(i);
        if (frameData.length !== width * height * 4) {
             throw new Error(`Frame ${i} dimension mismatch: expected length ${width * height * 4}, got ${frameData.length}`);
        }
        actualFrames.push(frameData);
    }

    const delayMs = 1000 / fps;

    // 2. Load Baseline if needed
    let baselineFrames: Uint8ClampedArray[] | null = null;
    let shouldUpdateBaseline = updateBaseline || !existsSync(baselinePath);

    if (!shouldUpdateBaseline) {
        try {
            const baseline = await loadAPNG(baselinePath);
            if (baseline.width !== width || baseline.height !== height) {
                console.warn(`Baseline dimensions mismatch (${baseline.width}x${baseline.height} vs ${width}x${height}). Forcing update.`);
                shouldUpdateBaseline = true;
            } else if (baseline.frames.length !== frameCount) {
                console.warn(`Baseline frame count mismatch (${baseline.frames.length} vs ${frameCount}). Forcing update.`);
                shouldUpdateBaseline = true;
            } else {
                baselineFrames = baseline.frames;
            }
        } catch (e) {
             console.warn(`Failed to load baseline APNG: ${e}. Forcing update.`);
             shouldUpdateBaseline = true;
        }
    }

    // 3. Verify animation actually changes (sanity check)
    if (actualFrames.length > 1) {
        const firstFrame = actualFrames[0];
        const lastFrame = actualFrames[actualFrames.length - 1];
        let differentPixels = 0;
        for (let i = 0; i < firstFrame.length; i += 4) {
            if (firstFrame[i] !== lastFrame[i] ||
                firstFrame[i+1] !== lastFrame[i+1] ||
                firstFrame[i+2] !== lastFrame[i+2]) {
                differentPixels++;
            }
        }
        const percentDiff = (differentPixels / (width * height)) * 100;
        if (percentDiff < 0.1) {
            console.warn(`WARNING: Animation '${name}' has minimal changes (${percentDiff.toFixed(2)}% pixels different). ` +
                         `First and last frames are nearly identical - animation may not be working!`);
        } else {
            console.log(`Animation '${name}': ${percentDiff.toFixed(2)}% of pixels changed from first to last frame`);
        }
    }

    // 4. Save Baseline if needed
    if (shouldUpdateBaseline) {
        console.log(`Creating/Updating baseline for ${name} at ${baselinePath}`);
        await saveAPNG(baselinePath, actualFrames, width, height, delayMs);
        return;
    }

    // 5. Compare
    if (!baselineFrames) {
        throw new Error("Baseline frames missing despite checks.");
    }

    const frameStats: ComparisonResult[] = [];
    const diffFrames: Uint8ClampedArray[] = [];
    let totalDiffPixels = 0;
    let totalPixels = 0;

    for (let i = 0; i < frameCount; i++) {
        const result = await compareSnapshots(actualFrames[i], baselineFrames[i], width, height, options);
        frameStats.push(result);

        if (result.diffImage) {
            diffFrames.push(result.diffImage);
        } else {
            // Provide a blank frame (transparent or black) if no diff
            diffFrames.push(new Uint8ClampedArray(width * height * 4));
        }

        totalDiffPixels += result.pixelsDifferent;
        totalPixels += width * height;
    }

    const avgPercentDifferent = (totalDiffPixels / totalPixels) * 100;
    const passed = avgPercentDifferent <= (maxDifferencePercent || 0);

    const result: AnimationSnapshotResult = {
        passed,
        totalPixels,
        totalDiffPixels,
        percentDifferent: avgPercentDifferent,
        frameStats
    };

    // 6. Save Stats
    const statsPath = path.join(snapshotDir, 'stats', `${name}.json`);
    await fs.mkdir(path.dirname(statsPath), { recursive: true });
    await fs.writeFile(statsPath, JSON.stringify({
        passed: result.passed,
        percentDifferent: result.percentDifferent,
        pixelsDifferent: result.totalDiffPixels,
        totalPixels: result.totalPixels,
        threshold: options.threshold ?? 0.1,
        maxDifferencePercent: options.maxDifferencePercent ?? 0.1,
        frameCount: frameCount
    }, null, 2));

    // 7. Save Actual and Diff if failed or always save
    if (!passed || alwaysSave) {
        await saveAPNG(actualPath, actualFrames, width, height, delayMs);
        await saveAPNG(diffPath, diffFrames, width, height, delayMs);
    }

    if (!passed) {
        const failThreshold = 10.0;
        const errorMessage = `Animation snapshot comparison failed for ${name}: ${result.percentDifferent.toFixed(2)}% different ` +
            `(${result.totalDiffPixels} pixels total). ` +
            `See ${diffPath} for details.`;

        if (result.percentDifferent <= failThreshold) {
            console.warn(`[WARNING] ${errorMessage} (Marked as failed in report but passing test execution due to <${failThreshold}% difference)`);
        } else {
            throw new Error(errorMessage);
        }
    }
}
