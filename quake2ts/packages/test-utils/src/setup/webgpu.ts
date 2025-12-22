import { create, globals } from 'webgpu';

/**
 * HeadlessWebGPUSetup interface
 */
export interface HeadlessWebGPUSetup {
  adapter: GPUAdapter;
  device: GPUDevice;
  cleanup: () => Promise<void>;
}

/**
 * Initializes a headless WebGPU environment using @webgpu/dawn (via 'webgpu' package).
 */
export async function initHeadlessWebGPU(
  options?: {
    powerPreference?: 'low-power' | 'high-performance';
    requiredFeatures?: GPUFeatureName[];
  }
): Promise<HeadlessWebGPUSetup> {
  // Check if we are in a Node.js environment
  const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

  let gpu: GPU;

  if (isNode) {
    // In Node.js, we use the 'webgpu' package (bindings to Dawn)
    if (globals) {
        Object.assign(global, globals);
    }
    // Create the GPU entry point
    gpu = create([]);
  } else {
    // In browser, use navigator.gpu
    if (!navigator.gpu) {
      throw new Error('WebGPU not supported in this browser.');
    }
    gpu = navigator.gpu;
  }

  const adapter = await gpu.requestAdapter({
    powerPreference: options?.powerPreference || 'high-performance',
  });

  if (!adapter) {
    throw new Error('Failed to request WebGPU adapter');
  }

  const device = await adapter.requestDevice({
    requiredFeatures: options?.requiredFeatures,
  });

  return {
    adapter,
    device,
    cleanup: async () => {
      device.destroy();
    }
  };
}

export interface WebGPUContextState {
    device: GPUDevice;
    adapter: GPUAdapter;
    queue: GPUQueue;
}

export async function createHeadlessTestContext(): Promise<WebGPUContextState> {
  const setup = await initHeadlessWebGPU();
  return {
    device: setup.device,
    adapter: setup.adapter,
    queue: setup.device.queue
  };
}
