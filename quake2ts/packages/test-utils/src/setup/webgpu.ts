
// Types for our setup
export interface HeadlessWebGPUSetup {
  adapter: GPUAdapter;
  device: GPUDevice;
  cleanup: () => Promise<void>;
}

export interface WebGPUContextState {
    adapter: GPUAdapter;
    device: GPUDevice;
    queue: GPUQueue;
    format: GPUTextureFormat;
}

/**
 * Setup the Headless WebGPU environment (globals, navigator.gpu) without creating a device.
 * Use this when tests create their own devices.
 */
export async function setupHeadlessWebGPUEnv(): Promise<void> {
  // Check if we are in Node.js environment
  if (typeof process === 'undefined' || process.release?.name !== 'node') {
    throw new Error('setupHeadlessWebGPUEnv should only be called in a Node.js environment');
  }

  // Dynamic import to avoid hard dependency
  let create, globals;
  try {
      const webgpu = await import('webgpu');
      create = webgpu.create;
      globals = webgpu.globals;
  } catch (e) {
      throw new Error(`Failed to load "webgpu" package. Please ensure it is installed. Original error: ${e}`);
  }

  // Inject WebGPU globals into globalThis if not already present
  // Note: we need to handle navigator specifically as it might be read-only in some envs (like jsdom)
  // or simply missing.
  if (!globalThis.navigator) {
      // @ts-ignore
      globalThis.navigator = {};
  }

  if (!globalThis.navigator.gpu) {
      // Create the GPU instance using the 'webgpu' package's create function
      // This is more robust than relying on 'globals' if 'globals' expects a clean environment
      const gpu = create([]);

      try {
          Object.defineProperty(globalThis.navigator, 'gpu', {
              value: gpu,
              writable: true,
              configurable: true
          });
      } catch (e) {
          // Fallback if defineProperty fails (e.g. read-only navigator in strict mode)
          // But usually in tests we can modify it.
          // If we are in JSDOM, navigator might be tricky.
          console.warn('Could not define navigator.gpu, trying direct assignment');
          // @ts-ignore
          globalThis.navigator.gpu = gpu;
      }

      // Also inject other globals like GPUAdapter, GPUDevice etc.
      Object.assign(globalThis, globals);
  }
}

/**
 * Initialize WebGPU in a headless Node.js environment using @webgpu/dawn (via webgpu package)
 */
export async function initHeadlessWebGPU(
  options?: {
    powerPreference?: 'low-power' | 'high-performance';
    requiredFeatures?: GPUFeatureName[];
  }
): Promise<HeadlessWebGPUSetup> {
  await setupHeadlessWebGPUEnv();

  // Request Adapter with retry mechanism for CI environments
  let adapter: GPUAdapter | null = null;
  const preferences: (GPURequestAdapterOptions['powerPreference'] | undefined)[] = [
    options?.powerPreference || 'high-performance',
    'low-power',
    undefined
  ];

  for (const pref of preferences) {
    try {
      adapter = await navigator.gpu.requestAdapter({
        powerPreference: pref,
      });
      if (adapter) {
        break;
      }
    } catch (e) {
      console.warn(`Failed to request adapter with preference ${pref}:`, e);
    }
  }

  if (!adapter) {
    throw new Error('Failed to create WebGPU adapter');
  }

  // Request Device
  const device = await adapter.requestDevice({
    requiredFeatures: options?.requiredFeatures || [],
  });

  if (!device) {
    throw new Error('Failed to create WebGPU device');
  }

  return {
    adapter,
    device,
    cleanup: async () => {
      device.destroy();
      // 'webgpu' package doesn't expose a way to explicitly destroy the adapter or the global instance
      // cleanly other than letting it be garbage collected or process exit.
      // However, destroying the device is usually sufficient for tests.
    }
  };
}

/**
 * Creates a complete context state for testing
 */
export async function createHeadlessTestContext(): Promise<WebGPUContextState> {
    const { adapter, device } = await initHeadlessWebGPU();
    return {
        adapter,
        device,
        queue: device.queue,
        format: 'rgba8unorm'
    };
}
