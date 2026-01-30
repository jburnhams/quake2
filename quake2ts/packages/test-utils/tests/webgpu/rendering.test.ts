import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { initHeadlessWebGPU, isWebGpuAvailable } from '../../src/setup/webgpu';
import { createRenderTestSetup, renderAndCapture } from '../../src/engine/helpers/webgpu-rendering';

describe('WebGPU Rendering Utilities', () => {
    let webgpuAvailable = false;

    beforeAll(async () => {
        webgpuAvailable = await isWebGpuAvailable();
        if (webgpuAvailable) {
            // Setup WebGPU - will throw if not available
            await initHeadlessWebGPU();
        }
    }, 30000); // Increase timeout to 30s for GPU initialization

    it('initializes render setup', async (ctx) => {
        if (!webgpuAvailable) {
            ctx.skip();
            return;
        }
        const setup = await createRenderTestSetup(64, 64);
        expect(setup.context.device).toBeDefined();
        expect(setup.renderTarget).toBeDefined();
        expect(setup.renderTarget.width).toBe(64);
        expect(setup.renderTarget.height).toBe(64);

        await setup.cleanup();
    });

    it('renders and captures output (clear color)', async (ctx) => {
        if (!webgpuAvailable) {
            ctx.skip();
            return;
        }
        const setup = await createRenderTestSetup(4, 4);

        // We do nothing in renderFn, relying on loadOp: 'clear' to set the color to transparent black
        const pixels = await renderAndCapture(setup, (pass) => {
            // No draw calls
        });

        expect(pixels).toBeDefined();
        expect(pixels.length).toBe(4 * 4 * 4);
        // Should be all zeros
        expect(pixels[0]).toBe(0);

        await setup.cleanup();
    });
});
