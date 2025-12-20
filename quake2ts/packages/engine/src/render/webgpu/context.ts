
// Context options interface
export interface WebGPUContextOptions {
  powerPreference?: GPUPowerPreference;
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
}

// Context state interface
export interface WebGPUContextState {
  adapter: GPUAdapter;
  device: GPUDevice;
  context?: GPUCanvasContext;
  format: GPUTextureFormat;
  features: Set<GPUFeatureName>;
  limits: GPUSupportedLimits;
  isHeadless: boolean;
}

/**
 * Creates and initializes a WebGPU context.
 *
 * Handles adapter selection, device creation, and context configuration.
 * Supports both browser (canvas) and headless environments.
 *
 * @param canvas - Optional canvas element for rendering. If omitted, assumes headless mode.
 * @param options - Configuration options for device creation.
 * @returns Initialized WebGPU context state.
 * @throws Error if WebGPU is not supported or device creation fails.
 */
export async function createWebGPUContext(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<WebGPUContextState> {
  const isHeadless = !canvas;

  // 1. Check WebGPU availability
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this environment.');
  }

  // 2. Request Adapter
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: options?.powerPreference ?? 'high-performance'
  });

  if (!adapter) {
    throw new Error('Failed to request WebGPU adapter.');
  }

  // 3. Determine features and limits
  const requiredFeatures: GPUFeatureName[] = options?.requiredFeatures ?? [];
  const requiredLimits: Record<string, number> = options?.requiredLimits ?? {};

  // 4. Request Device
  const device = await adapter.requestDevice({
    requiredFeatures,
    requiredLimits
  });

  if (!device) {
    throw new Error('Failed to create WebGPU device.');
  }

  // 5. Handle Context (if canvas provided)
  let context: GPUCanvasContext | undefined;
  let format: GPUTextureFormat;

  if (canvas) {
    context = canvas.getContext('webgpu') as GPUCanvasContext;
    if (!context) {
      throw new Error('Failed to get WebGPU context from canvas.');
    }

    format = navigator.gpu.getPreferredCanvasFormat();

    // Determine usage flags (RenderAttachment is basic, CopySrc for screenshots)
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC;

    context.configure({
      device,
      format,
      alphaMode: 'opaque', // Default to opaque for now
      usage
    });
  } else {
    // Headless mode - default format (can be overridden by render targets)
    format = 'rgba8unorm';
  }

  // 6. Capture features and limits
  const features = new Set<GPUFeatureName>();
  device.features.forEach((feature) => features.add(feature as GPUFeatureName));

  return {
    adapter,
    device,
    context,
    format,
    features,
    limits: device.limits,
    isHeadless
  };
}
