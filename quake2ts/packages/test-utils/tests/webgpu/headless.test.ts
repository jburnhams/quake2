import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { initHeadlessWebGPU, createHeadlessTestContext } from '../../src/setup/webgpu';
import { createMockGPUAdapter, createMockGPUDevice } from '../../src/engine/mocks/webgpu';

describe('WebGPU Headless Setup', () => {
  beforeEach(() => {
    vi.resetModules();
    // Mock webgpu module for the dynamic import in initHeadlessWebGPU
    vi.doMock('webgpu', () => {
        const mockAdapter = createMockGPUAdapter();
        const mockDevice = createMockGPUDevice();
        (mockAdapter.requestDevice as any).mockResolvedValue(mockDevice);

        return {
            create: vi.fn(() => ({
                requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
            })),
            globals: {
                GPUAdapter: class {},
                GPUDevice: class {},
                GPUQueue: class {},
                GPUBuffer: class {},
                GPUTexture: class {},
                // Add other globals as needed by setupHeadlessWebGPUEnv
            }
        };
    });
  });

  afterEach(() => {
    vi.doUnmock('webgpu');
    if (globalThis.navigator && (globalThis.navigator as any).gpu) {
        try {
            delete (globalThis.navigator as any).gpu;
        } catch (e) {}
    }
  });

  it('should initialize WebGPU in Node.js environment', async () => {
    const setup = await initHeadlessWebGPU();
    expect(setup).toBeDefined();
    expect(setup.adapter).toBeDefined();
    expect(setup.device).toBeDefined();
    expect(setup.cleanup).toBeTypeOf('function');

    await setup.cleanup();
  });

  it('should create a test context with adapter, device and queue', async () => {
    const context = await createHeadlessTestContext();
    expect(context).toBeDefined();
    expect(context.adapter).toBeDefined();
    expect(context.device).toBeDefined();
    expect(context.queue).toBeDefined();

    // Cleanup via destroying device manually since createHeadlessTestContext doesn't return cleanup
    context.device.destroy();
  });

  it('should allow requesting specific power preference', async () => {
    const setup = await initHeadlessWebGPU({ powerPreference: 'low-power' });
    expect(setup).toBeDefined();
    await setup.cleanup();
  });
});
