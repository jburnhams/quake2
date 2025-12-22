/// <reference types="@webgpu/types" />

export interface WebGPUContextOptions {
  /**
   * Power preference for adapter selection.
   * Defaults to 'high-performance'.
   */
  readonly powerPreference?: GPUPowerPreference;
  /**
   * Required features. Throws if any are missing.
   */
  readonly requiredFeatures?: GPUFeatureName[];
  /**
   * Required limits. Throws if any cannot be met.
   */
  readonly requiredLimits?: Record<string, number>;
}

export interface WebGPUContextState {
  readonly adapter: GPUAdapter;
  readonly device: GPUDevice;
  /**
   * The canvas context, if a canvas was provided. Undefined for headless contexts.
   */
  readonly context?: GPUCanvasContext;
  /**
   * The preferred texture format for the surface (e.g. bgra8unorm).
   */
  readonly format: GPUTextureFormat;
  readonly features: Set<GPUFeatureName>;
  readonly limits: GPUSupportedLimits;
  readonly isHeadless: boolean;
  dispose(): void;
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

export type ContextLostHandler = (reason: GPUDeviceLostReason, message: string) => void;

function hasFeature(features: ReadonlySet<string> | GPUFeatureName[], feature: string): boolean {
  if (Array.isArray(features)) {
    return features.includes(feature as GPUFeatureName);
  }
  return features.has(feature as GPUFeatureName);
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
  }).catch((err) => {
    // Should not happen for device.lost promise, but good practice
    console.error('Error in device lost handler:', err);
  });
}

export async function createWebGPUContext(
  canvas?: HTMLCanvasElement,
  options: WebGPUContextOptions = {}
): Promise<WebGPUContextState> {
  const {
    powerPreference = 'high-performance',
    requiredFeatures = [],
    requiredLimits = {},
  } = options;

  if (!navigator.gpu) {
    throw new Error('WebGPU not supported: navigator.gpu is missing');
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference,
  });

  if (!adapter) {
    throw new Error('Failed to request WebGPU adapter');
  }

  // Validate required features
  const availableFeatures = new Set(adapter.features.keys());
  for (const feature of requiredFeatures) {
    if (!availableFeatures.has(feature)) {
      throw new Error(`Required WebGPU feature not available: ${feature}`);
    }
  }

  // Check strict limits if needed - requestDevice will fail if limits aren't met,
  // but we can pre-check or just let it fail. We'll let requestDevice handle it.

  const device = await adapter.requestDevice({
    requiredFeatures,
    requiredLimits,
  });

  if (!device) {
    // This case usually throws, but type-wise requestDevice returns Promise<GPUDevice>
    throw new Error('Failed to create WebGPU device');
  }

  let context: GPUCanvasContext | undefined;
  let format: GPUTextureFormat;
  const isHeadless = !canvas;

  if (canvas) {
    context = canvas.getContext('webgpu') as GPUCanvasContext;
    if (!context) {
      throw new Error('Failed to get WebGPU context from canvas');
    }
    format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
      device,
      format,
      alphaMode: 'opaque', // Default to opaque, matches WebGL behavior usually
    });
  } else {
    // For headless, we typically pick a standard format like rgba8unorm
    format = 'rgba8unorm';
  }

  return {
    adapter,
    device,
    context,
    format,
    features: new Set(device.features.keys()) as Set<GPUFeatureName>,
    limits: device.limits,
    isHeadless,
    dispose() {
      device.destroy();
    },
  };
}
