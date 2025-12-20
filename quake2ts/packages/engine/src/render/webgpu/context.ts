export interface WebGPUContextOptions {
  powerPreference?: GPUPowerPreference;
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
}

export interface WebGPUContextState {
  adapter: GPUAdapter;
  device: GPUDevice;
  context?: GPUCanvasContext;
  format: GPUTextureFormat;
  features: Set<GPUFeatureName>;
  limits: GPUSupportedLimits;
  isHeadless: boolean;
}

export interface WebGPUCapabilities {
  hasTimestampQuery: boolean;
  hasDepthClipControl: boolean;
  hasTextureCompressionBC: boolean;
  hasTextureCompressionETC2: boolean;
  hasTextureCompressionASTC: boolean;
  maxTextureDimension2D: number;
  maxBindGroups: number;
  maxUniformBufferBindingSize: number;
  maxStorageBufferBindingSize: number;
}

export type ContextLostHandler = (reason: GPUDeviceLostReason) => void;

/**
 * Creates and initializes a WebGPU context.
 *
 * @param canvas - The HTML canvas element to render to (optional for headless).
 * @param options - Configuration options for the context.
 * @returns The initialized WebGPU context state.
 */
export async function createWebGPUContext(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<WebGPUContextState> {
  // 1. Validate WebGPU Support
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this environment.');
  }

  // 2. Request Adapter
  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: options?.powerPreference ?? 'high-performance',
  });

  if (!adapter) {
    throw new Error('Failed to request WebGPU adapter.');
  }

  // 3. Validate Features
  if (options?.requiredFeatures) {
    for (const feature of options.requiredFeatures) {
      if (!adapter.features.has(feature)) {
        throw new Error(`Required feature '${feature}' is not supported by the adapter.`);
      }
    }
  }

  // 4. Request Device
  // We include required features and limits.
  // Note: We might want to request all available features or just specific ones.
  // For now, we respect the options, but could default to requesting everything useful.
  const requiredFeatures: GPUFeatureName[] = options?.requiredFeatures || [];

  // Also check for some commonly useful features if available, but don't fail if not?
  // The plan says "Initially require none".

  const deviceDescriptor: GPUDeviceDescriptor = {
    requiredFeatures: requiredFeatures,
    requiredLimits: options?.requiredLimits,
  };

  const device = await adapter.requestDevice(deviceDescriptor);

  // 5. Configure Canvas Context (if provided)
  let context: GPUCanvasContext | undefined;
  let format: GPUTextureFormat;
  const isHeadless = !canvas;

  if (canvas) {
    context = canvas.getContext('webgpu') as GPUCanvasContext;
    if (!context) {
      throw new Error('Failed to get WebGPU context from canvas.');
    }

    format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({
      device,
      format,
      alphaMode: 'premultiplied', // Standard for web
    });
  } else {
    // For headless, we might default to rgba8unorm or similar,
    // but the caller will likely create textures manually.
    // We pick a reasonable default "screen" format.
    // In node environment with webgpu package, getPreferredCanvasFormat might not exist or return differently.
    // We safely check for its existence.
    if (navigator.gpu.getPreferredCanvasFormat) {
       format = navigator.gpu.getPreferredCanvasFormat();
    } else {
       format = 'rgba8unorm';
    }
  }

  // 6. Gather Features and Limits
  const features = new Set<GPUFeatureName>();
  // adapter.features is a GPUSupportedFeatures object which is set-like
  // iterating it works in modern browsers.
  for (const feature of adapter.features) {
    features.add(feature as GPUFeatureName);
  }

  return {
    adapter,
    device,
    context,
    format,
    features,
    limits: device.limits,
    isHeadless,
  };
}

/**
 * Queries the capabilities of the current WebGPU context.
 */
export function queryCapabilities(state: WebGPUContextState): WebGPUCapabilities {
  const { adapter, device } = state;

  return {
    hasTimestampQuery: adapter.features.has('timestamp-query'),
    hasDepthClipControl: adapter.features.has('depth-clip-control'),
    hasTextureCompressionBC: adapter.features.has('texture-compression-bc'),
    hasTextureCompressionETC2: adapter.features.has('texture-compression-etc2'),
    hasTextureCompressionASTC: adapter.features.has('texture-compression-astc'),
    maxTextureDimension2D: device.limits.maxTextureDimension2D,
    maxBindGroups: device.limits.maxBindGroups,
    maxUniformBufferBindingSize: device.limits.maxUniformBufferBindingSize,
    maxStorageBufferBindingSize: device.limits.maxStorageBufferBindingSize,
  };
}

/**
 * Sets up handling for device loss.
 */
export function setupDeviceLossHandling(
  device: GPUDevice,
  onLost: ContextLostHandler
): void {
  device.lost.then((info) => {
    // info is GPUDeviceLostInfo
    // The reason can be 'destroyed' or 'unknown' (or others in future specs)
    onLost(info.reason);
  });
}
