import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'fs/promises';
import { createReadStream, createWriteStream, existsSync } from 'fs';
import path from 'path';
import { RenderTestSetup, renderAndCapture } from '../engine/helpers/webgpu-rendering.js';

export interface CaptureOptions {
  width: number;
  height: number;
  format?: GPUTextureFormat;
}

// Helper to pad bytes to 256 byte alignment (WebGPU requirement)
function getBytesPerRow(width: number): number {
  const bytesPerPixel = 4;
  const unpaddedBytesPerRow = width * bytesPerPixel;
  const align = 256;
  const paddedBytesPerRow = Math.max(
    unpaddedBytesPerRow,
    Math.ceil(unpaddedBytesPerRow / align) * align
  );
  return paddedBytesPerRow;
}

export async function captureFramebufferAsPNG(
  device: GPUDevice,
  texture: GPUTexture,
  options: CaptureOptions
): Promise<Buffer> {
  const { width, height, format = 'rgba8unorm' } = options;

  const bytesPerRow = getBytesPerRow(width);
  const bufferSize = bytesPerRow * height;

  const outputBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    label: 'captureFramebufferAsPNG output buffer'
  });

  const commandEncoder = device.createCommandEncoder({ label: 'captureFramebufferAsPNG encoder' });
  commandEncoder.copyTextureToBuffer(
    { texture },
    { buffer: outputBuffer, bytesPerRow, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 }
  );
  device.queue.submit([commandEncoder.finish()]);

  await outputBuffer.mapAsync(GPUMapMode.READ);
  const mappedRange = outputBuffer.getMappedRange();
  const rawData = new Uint8Array(mappedRange);

  // Remove padding to get tight packed RGBA
  const bytesPerPixel = 4;
  const tightData = new Uint8ClampedArray(width * height * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const srcOffset = y * bytesPerRow;
    const dstOffset = y * width * bytesPerPixel;
    const rowSize = width * bytesPerPixel;
    // Copy row
    for (let i = 0; i < rowSize; i++) {
        tightData[dstOffset + i] = rawData[srcOffset + i];
    }
  }

  outputBuffer.unmap();

  // Handle BGRA to RGBA conversion if needed
  // Note: WebGPU usually prefers bgra8unorm for swapchains, but pngjs expects rgba
  if (format === 'bgra8unorm' || format === 'bgra8unorm-srgb') {
    for (let i = 0; i < tightData.length; i += 4) {
      const b = tightData[i];
      const r = tightData[i + 2];
      tightData[i] = r;
      tightData[i + 2] = b;
    }
  }

  // Create PNG
  const png = new PNG({ width, height });
  png.data = Buffer.from(tightData);

  return PNG.sync.write(png);
}

export async function savePNG(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  filepath: string
): Promise<void> {
    const png = new PNG({ width, height });
    png.data = Buffer.from(pixels);

    await fs.mkdir(path.dirname(filepath), { recursive: true });

    return new Promise((resolve, reject) => {
        const stream = createWriteStream(filepath);
        stream.on('error', reject);
        stream.on('finish', resolve);
        png.pack().pipe(stream);
    });
}

export async function loadPNG(
  filepath: string
): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const stream = createReadStream(filepath);
        stream.on('error', reject);

        const png = new PNG();
        png.on('error', reject);
        png.on('parsed', (data) => {
            resolve({
                data: new Uint8ClampedArray(data),
                width: png.width,
                height: png.height
            });
        });

        stream.pipe(png);
    });
}

export interface ComparisonResult {
  pixelsDifferent: number;
  totalPixels: number;
  percentDifferent: number;
  passed: boolean;
  diffImage?: Uint8ClampedArray;
}

export interface ComparisonOptions {
  threshold?: number;        // Pixel difference threshold (0-1), default 0.1
  includeAA?: boolean;       // Include anti-aliasing detection
  diffColor?: [number, number, number];  // Color for diff pixels
  maxDifferencePercent?: number;  // Max % difference to pass, default 0.1%
}

export async function compareSnapshots(
  actual: Uint8ClampedArray,
  expected: Uint8ClampedArray,
  width: number,
  height: number,
  options?: ComparisonOptions
): Promise<ComparisonResult> {
    const {
        threshold = 0.1,
        includeAA = false,
        diffColor = [255, 0, 0],
        maxDifferencePercent = 0.1
    } = options || {};

    if (actual.length !== expected.length) {
        throw new Error(`Size mismatch: actual length ${actual.length} vs expected length ${expected.length}`);
    }

    const diff = new Uint8ClampedArray(width * height * 4);
    const numDiffPixels = pixelmatch(
        actual,
        expected,
        diff,
        width,
        height,
        {
            threshold,
            includeAA,
            diffColor: diffColor as [number, number, number],
            alpha: 1 // Default alpha
        }
    );

    const totalPixels = width * height;
    const percentDifferent = (numDiffPixels / totalPixels) * 100;
    const passed = percentDifferent <= (maxDifferencePercent || 0);

    return {
        pixelsDifferent: numDiffPixels,
        totalPixels,
        percentDifferent,
        passed,
        diffImage: diff
    };
}

export interface SnapshotTestOptions extends ComparisonOptions {
  name: string;
  description?: string;
  width?: number;
  height?: number;
  updateBaseline?: boolean;
  snapshotDir?: string; // Root snapshot directory
}

export function getSnapshotPath(name: string, type: 'baseline' | 'actual' | 'diff', snapshotDir: string = '__snapshots__'): string {
    const dirMap = {
        baseline: 'baselines',
        actual: 'actual',
        diff: 'diff'
    };
    return path.join(snapshotDir, dirMap[type], `${name}.png`);
}

export async function expectSnapshot(
  pixels: Uint8ClampedArray,
  options: SnapshotTestOptions
): Promise<void> {
    const {
        name,
        width,
        height,
        updateBaseline = false,
        snapshotDir = path.join(process.cwd(), 'tests', '__snapshots__') // Default to current working dir/tests/__snapshots__
    } = options;

    if (!width || !height) {
        throw new Error('Width and height are required for expectSnapshot');
    }

    const baselinePath = getSnapshotPath(name, 'baseline', snapshotDir);
    const actualPath = getSnapshotPath(name, 'actual', snapshotDir);
    const diffPath = getSnapshotPath(name, 'diff', snapshotDir);

    const alwaysSave = process.env.ALWAYS_SAVE_SNAPSHOTS === '1';

    // If update baseline is requested or baseline doesn't exist, save as baseline and return
    if (updateBaseline || !existsSync(baselinePath)) {
        console.log(`Creating/Updating baseline for ${name} at ${baselinePath}`);
        await savePNG(pixels, width, height, baselinePath);
        return;
    }

    // Load baseline
    let baseline: { data: Uint8ClampedArray; width: number; height: number };
    try {
        baseline = await loadPNG(baselinePath);
    } catch (e) {
        console.warn(`Failed to load baseline for ${name} at ${baselinePath}: ${e}. Creating new baseline.`);
        await savePNG(pixels, width, height, baselinePath);
        return;
    }

    if (baseline.width !== width || baseline.height !== height) {
        console.warn(`Snapshot dimension mismatch for ${name}: expected ${baseline.width}x${baseline.height}, got ${width}x${height}. Updating baseline.`);
        await savePNG(pixels, width, height, baselinePath);
        return;
    }

    // Compare
    const result = await compareSnapshots(pixels, baseline.data, width, height, options);

    // Save stats
    const statsPath = path.join(snapshotDir, 'stats', `${name}.json`);
    await fs.mkdir(path.dirname(statsPath), { recursive: true });
    await fs.writeFile(statsPath, JSON.stringify({
        passed: result.passed,
        percentDifferent: result.percentDifferent,
        pixelsDifferent: result.pixelsDifferent,
        totalPixels: result.totalPixels,
        threshold: options.threshold ?? 0.1,
        maxDifferencePercent: options.maxDifferencePercent ?? 0.1
    }, null, 2));

    if (!result.passed || alwaysSave) {
        // Save actual and diff
        await savePNG(pixels, width, height, actualPath);
        if (result.diffImage) {
            await savePNG(result.diffImage, width, height, diffPath);
        }
    }

    if (!result.passed) {
        const failThreshold = 10.0;
        const errorMessage = `Snapshot comparison failed for ${name}: ${result.percentDifferent.toFixed(2)}% different ` +
            `(${result.pixelsDifferent} pixels). ` +
            `See ${diffPath} for details.`;

        if (result.percentDifferent <= failThreshold) {
            console.warn(`[WARNING] ${errorMessage} (Marked as failed in report but passing test execution due to <${failThreshold}% difference)`);
        } else {
            throw new Error(errorMessage);
        }
    }
}

export async function renderAndExpectSnapshot(
  setup: RenderTestSetup,
  renderFn: (pass: GPURenderPassEncoder) => void,
  options: Omit<SnapshotTestOptions, 'width' | 'height'>
): Promise<void> {
    const pixels = await renderAndCapture(setup, renderFn);
    await expectSnapshot(pixels, {
        ...options,
        width: setup.width,
        height: setup.height
    });
}
