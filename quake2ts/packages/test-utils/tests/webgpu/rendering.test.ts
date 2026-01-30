import { describe, it, expect } from 'vitest';
import { initHeadlessWebGPU } from '../../src/setup/webgpu';
import { createRenderTestSetup, renderAndCapture } from '../../src/engine/helpers/webgpu-rendering';

// These tests are intended to run against a real WebGPU implementation (e.g., using mesa-vulkan-drivers in CI)
// and should fail if the environment is not correctly configured.
// Do NOT mock 'webgpu' here.

describe('WebGPU Rendering Utilities', () => {
    it('initializes render setup', async () => {
        const setup = await createRenderTestSetup(64, 64);
        expect(setup.context.device).toBeDefined();
        expect(setup.renderTarget).toBeDefined();
        expect(setup.renderTarget.width).toBe(64);
        expect(setup.renderTarget.height).toBe(64);

        await setup.cleanup();
    });

    it('renders and captures output (clear color)', async () => {
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
