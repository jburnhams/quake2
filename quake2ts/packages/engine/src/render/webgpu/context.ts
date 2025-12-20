export interface WebGPUContextOptions {
  powerPreference?: GPUPowerPreference;
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
}

export interface WebGPUContextState {
  adapter: GPUAdapter;
  device: GPUDevice;
  context?: GPUCanvasContext;  // undefined for headless
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

export interface ContextLostHandler {
  (reason: GPUDeviceLostReason, message: string): void;
}

export async function createWebGPUContext(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<WebGPUContextState> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this environment');
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: options?.powerPreference ?? 'high-performance'
  });

  if (!adapter) {
    throw new Error('Failed to request WebGPU adapter');
  }

  // Validate required features
  if (options?.requiredFeatures) {
    for (const feature of options.requiredFeatures) {
      if (!adapter.features.has(feature)) {
        throw new Error(`Required WebGPU feature '${feature}' is not supported by the adapter`);
      }
    }
  }

  const device = await adapter.requestDevice({
    requiredFeatures: options?.requiredFeatures,
    requiredLimits: options?.requiredLimits
  });

  if (!device) {
    throw new Error('Failed to request WebGPU device');
  }

  let context: GPUCanvasContext | undefined;
  let format: GPUTextureFormat;

  if (canvas) {
    context = canvas.getContext('webgpu') as GPUCanvasContext;
    if (!context) {
      throw new Error('Failed to get WebGPU context from canvas');
    }
    format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'premultiplied'
    });
  } else {
    // Headless mode fallback format
    format = 'rgba8unorm';
  }

  const features = new Set<GPUFeatureName>();
  // We can iterate the features from the device or adapter
  // device.features is a set-like object
  // @ts-ignore - GPUFeatureName is string
  for (const feature of device.features) {
    features.add(feature as GPUFeatureName);
  }

  return {
    adapter,
    device,
    context,
    format,
    features,
    limits: device.limits,
    isHeadless: !canvas
  };
}

export function queryCapabilities(state: WebGPUContextState): WebGPUCapabilities {
  const { features, limits } = state;

  return {
    hasTimestampQuery: features.has('timestamp-query'),
    hasDepthClipControl: features.has('depth-clip-control'),
    hasTextureCompressionBC: features.has('texture-compression-bc'),
    hasTextureCompressionETC2: features.has('texture-compression-etc2'),
    hasTextureCompressionASTC: features.has('texture-compression-astc'),
    maxTextureDimension2D: limits.maxTextureDimension2D,
    maxBindGroups: limits.maxBindGroups,
    maxUniformBufferBindingSize: limits.maxUniformBufferBindingSize,
    maxStorageBufferBindingSize: limits.maxStorageBufferBindingSize,
  };
}

export function setupDeviceLossHandling(
  device: GPUDevice,
  onLost: ContextLostHandler
): void {
  device.lost.then((info) => {
    onLost(info.reason, info.message);
  }).catch((error) => {
    console.error('Error handling device lost:', error);
  });
}
