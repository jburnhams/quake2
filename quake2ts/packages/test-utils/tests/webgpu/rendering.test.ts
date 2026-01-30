import { describe, it, expect, beforeAll, afterEach, vi, beforeEach } from 'vitest';
import { globals as realGlobals } from 'webgpu';
import { initHeadlessWebGPU } from '../../src/setup/webgpu';
import { createRenderTestSetup, renderAndCapture } from '../../src/engine/helpers/webgpu-rendering';
import { createMockGPUAdapter, createMockGPUDevice } from '../../src/engine/mocks/webgpu';

describe('WebGPU Rendering Utilities', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.doMock('webgpu', () => {
            const mockAdapter = createMockGPUAdapter();
            const mockDevice = createMockGPUDevice();
            (mockAdapter.requestDevice as any).mockResolvedValue(mockDevice);

            return {
                create: vi.fn(() => ({
                    requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
                })),
                globals: {
                    ...realGlobals,
                    // Override classes that might depend on native bindings
                    GPUAdapter: class {},
                    GPUDevice: class {},
                    GPUQueue: class {},
                    GPUBuffer: class {},
                    GPUTexture: class {},
                    GPUTextureView: class {},
                    GPUSampler: class {},
                    GPUBindGroupLayout: class {},
                    GPUPipelineLayout: class {},
                    GPUBindGroup: class {},
                    GPUShaderModule: class {},
                    GPUComputePipeline: class {},
                    GPURenderPipeline: class {},
                    GPUCommandEncoder: class {},
                    GPURenderPassEncoder: class {},
                    GPUComputePassEncoder: class {},
                }
            };
        });
    });

    afterEach(() => {
        vi.doUnmock('webgpu');
    });

    // We rely on createRenderTestSetup calling initHeadlessWebGPU internally (via createHeadlessTestContext)
    // or we can call it here if needed, but since we reset modules in beforeEach,
    // we should let the test flow handle initialization to ensure the mock is picked up.

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
        // Since we are mocking, the buffer content depends on createMockGPUBuffer implementation.
        // It likely returns an empty ArrayBuffer or zeros.
        expect(pixels.length).toBe(4 * 4 * 4);

        await setup.cleanup();
    });
});
