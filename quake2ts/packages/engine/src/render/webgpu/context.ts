/// <reference types="@webgpu/types" />

export interface WebGPUContextOptions {
  powerPreference?: 'low-power' | 'high-performance';
  requiredFeatures?: GPUFeatureName[];
  requiredLimits?: Record<string, number>;
  width?: number;
  height?: number;
}

export interface WebGPUContextState {
  adapter: GPUAdapter;
  device: GPUDevice;
  context?: GPUCanvasContext;  // undefined for headless
  format: GPUTextureFormat;
  depthFormat: GPUTextureFormat; // New: Standardized depth format
  features: Set<GPUFeatureName>;
  limits: GPUSupportedLimits;
  isHeadless: boolean;
  width: number;
  height: number;
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
 * Creates and initializes a WebGPU context and device.
 */
export async function createWebGPUContext(
  canvas?: HTMLCanvasElement,
  options?: WebGPUContextOptions
): Promise<WebGPUContextState> {
  if (!navigator.gpu) {
    throw new Error('WebGPU is not supported in this environment');
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: options?.powerPreference || 'high-performance',
  });

  if (!adapter) {
    throw new Error('No appropriate GPUAdapter found');
  }

  // Validate required features
  if (options?.requiredFeatures) {
    for (const feature of options.requiredFeatures) {
      if (!adapter.features.has(feature)) {
        throw new Error(`Required feature not available: ${feature}`);
      }
    }
  }

  // Create device
  const deviceDescriptor: GPUDeviceDescriptor = {
    requiredFeatures: options?.requiredFeatures,
    requiredLimits: options?.requiredLimits,
  };

  const device = await adapter.requestDevice(deviceDescriptor);

  let context: GPUCanvasContext | undefined;
  let format: GPUTextureFormat = 'rgba8unorm'; // Default for headless
  const depthFormat: GPUTextureFormat = 'depth24plus'; // Standard depth format
  let isHeadless = true;
  let width = options?.width || 800;
  let height = options?.height || 600;

  if (canvas) {
    context = canvas.getContext('webgpu') as GPUCanvasContext;
    if (!context) {
      throw new Error('Failed to get WebGPU context from canvas');
    }

    isHeadless = false;
    format = navigator.gpu.getPreferredCanvasFormat(); // Use preferred format for canvas
    width = canvas.width;
    height = canvas.height;

    context.configure({
      device,
      format,
      alphaMode: 'opaque', // Standard for game rendering
    });
  }

  // Collect enabled features
  const features = new Set<GPUFeatureName>();
  for (const feature of adapter.features) {
    features.add(feature as GPUFeatureName);
  }

  return {
    adapter,
    device,
    context,
    format,
    depthFormat,
    features,
    limits: device.limits,
    isHeadless,
    width,
    height
  };
}

/**
 * Queries capabilities of the created context/device.
 */
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

/**
 * Sets up handling for device loss.
 */
export function setupDeviceLossHandling(
  device: GPUDevice,
  onLost: ContextLostHandler
): void {
  device.lost.then((info) => {
    console.warn(`WebGPU Device Lost: ${info.reason} - ${info.message}`);
    onLost(info.reason);
  });
}
