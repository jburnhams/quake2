import { describe, it, expect, beforeAll } from 'vitest';
import { createWebGPUContext } from '../../../src/render/webgpu/context.js';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../../src/render/webgpu/headless.js';

// We try to use the 'webgpu' package which provides Dawn bindings for Node.js
let webgpu: any;
let gpuInstance: any;

try {
  const pkg = await import('webgpu');
  webgpu = pkg;
} catch (e) {
  console.warn('WebGPU (dawn) bindings not found or failed to load:', e);
}

describe('WebGPU Real Integration (Headless with Dawn)', () => {
  // Only run if we successfully loaded the bindings
  const shouldRun = !!webgpu;
  const runTest = shouldRun ? it : it.skip;

  beforeAll(() => {
    if (!shouldRun) return;

    // 1. Polyfill WebGPU Globals (GPUBufferUsage, etc.)
    if (webgpu.globals) {
        Object.assign(global, webgpu.globals);
    }

    // 2. Create the GPU entry point
    // The 'webgpu' package uses `create(flags)` to return the GPU implementation
    if (webgpu.create) {
        gpuInstance = webgpu.create([]);
    }

    // 3. Polyfill navigator.gpu
    // In JSDOM, navigator exists, so we redefine the property
    if (typeof navigator !== 'undefined') {
        Object.defineProperty(navigator, 'gpu', {
            value: gpuInstance,
            writable: true,
            configurable: true
        });

        // Also polyfill getPreferredCanvasFormat if missing (node implementation might not have it on the gpu object directly or name it differently)
        if (!gpuInstance.getPreferredCanvasFormat) {
            gpuInstance.getPreferredCanvasFormat = () => 'rgba8unorm';
        }
    } else {
        // Node environment without JSDOM (unlikely given vitest config, but safe fallback)
        (global as any).navigator = {
            gpu: gpuInstance
        };
    }
  });

  runTest('should initialize a real WebGPU device and capture a texture', async () => {
    // 1. Create Context
    // We pass no canvas, forcing headless mode
    const contextState = await createWebGPUContext(undefined, {
        powerPreference: 'low-power'
    });

    expect(contextState.device).toBeDefined();
    expect(contextState.isHeadless).toBe(true);
    expect(contextState.features).toBeDefined();

    console.log(`Initialized WebGPU Device: ${contextState.adapter.constructor.name}`);

    // 2. Create Render Target
    const width = 64;
    const height = 64;
    // Note: node-webgpu often prefers bgra8unorm or rgba8unorm.
    const renderTarget = createHeadlessRenderTarget(contextState.device, width, height, 'rgba8unorm');

    expect(renderTarget.texture).toBeDefined();
    expect(renderTarget.width).toBe(width);

    // 3. Clear the texture to a specific color (Orange)
    const encoder = contextState.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: renderTarget.view,
            clearValue: { r: 1.0, g: 0.5, b: 0.25, a: 1.0 },
            loadOp: 'clear',
            storeOp: 'store'
        }]
    });
    pass.end();
    contextState.device.queue.submit([encoder.finish()]);

    // 4. Capture Result
    const pixels = await captureRenderTarget(contextState.device, renderTarget.texture);

    expect(pixels).toBeInstanceOf(Uint8ClampedArray);
    expect(pixels.length).toBe(width * height * 4);

    // 5. Verify Pixel Data
    // Check the first pixel
    const r = pixels[0];
    const g = pixels[1];
    const b = pixels[2];
    const a = pixels[3];

    // console.log(`Captured Pixel: ${r}, ${g}, ${b}, ${a}`);

    // We use a wider tolerance because different backends/drivers might do sRGB conversion slightly differently
    // or unorm rounding might vary.
    expect(r).toBeCloseTo(255, -1);
    expect(g).toBeCloseTo(127, -1); // 0.5 * 255
    expect(b).toBeCloseTo(63, -1);  // 0.25 * 255
    expect(a).toBeCloseTo(255, -1);

    // Explicitly destroy the device to try and avoid N-API crash on exit
    contextState.device.destroy();
  });
});
