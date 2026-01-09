import { FrameRenderOptions, WorldRenderState } from './frame.js';
import { RenderableEntity } from './scene.js';
import { CollisionVisRenderer } from './collisionVis.js';
import { DebugRenderer } from './debug.js';
import { ParticleSystem } from './particleSystem.js';
import { MemoryUsage } from './types.js';
import { Texture2D as WebGLTexture2D } from './resources.js';
import { PreparedTexture } from '../assets/texture.js';
import { DebugMode } from './debugMode.js';
import { Md2Model } from '../assets/md2.js';
import { Md3Model } from '../assets/md3.js';
import { InstanceData } from './instancing.js';
import { RenderOptions } from './options.js';
import { RenderStatistics } from './gpuProfiler.js';
import { Vec3 } from '@quake2ts/shared';

// Pic can be either WebGL or WebGPU texture
export type Pic = WebGLTexture2D | {
  readonly width: number;
  readonly height: number;
  readonly texture?: GPUTexture;
  upload?: (data: BufferSource, options?: any) => void;
  destroy?: () => void;
};

// Common debug renderer interface that works for both WebGL and WebGPU
export interface IDebugRenderer {
  readonly shaderSize: number;
  drawLine(start: Vec3, end: Vec3, color: { r: number; g: number; b: number }): void;
  drawBoundingBox(mins: Vec3, maxs: Vec3, color: { r: number; g: number; b: number }): void;
  drawPoint(position: Vec3, size: number, color: { r: number; g: number; b: number }): void;
  drawAxes(position: Vec3, size: number): void;
  drawText3D(text: string, position: Vec3): void;
  addCone(apex: Vec3, baseCenter: Vec3, baseRadius: number, color: { r: number; g: number; b: number }): void;
  addTorus(center: Vec3, radius: number, tubeRadius: number, color: { r: number; g: number; b: number }, axis?: Vec3): void;
  clear(): void;
}

export interface IRenderer {
  width: number;
  height: number;
  collisionVis: CollisionVisRenderer;
  debug: DebugRenderer | IDebugRenderer;
  particleSystem: ParticleSystem;

  getPerformanceReport(): RenderStatistics;
  getMemoryUsage(): MemoryUsage;

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[],
    renderOptions?: RenderOptions
  ): void;

  registerPic(name: string, data: ArrayBuffer): Promise<Pic>;
  registerTexture(name: string, texture: PreparedTexture): Pic;
  getTexture?(name: string): Pic | undefined;
  getTextures?(): ReadonlyMap<string, Pic>;

  begin2D(): void;
  end2D(): void;

  drawPic(
    x: number,
    y: number,
    pic: Pic,
    color?: [number, number, number, number]
  ): void;

  drawString(
    x: number,
    y: number,
    text: string,
    color?: [number, number, number, number]
  ): void;

  drawCenterString(
    y: number,
    text: string
  ): void;

  drawfillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    color: [number, number, number, number]
  ): void;

  setEntityHighlight(entityId: number, color: [number, number, number, number]): void;
  clearEntityHighlight(entityId: number): void;
  highlightSurface(faceIndex: number, color: [number, number, number, number]): void;
  removeSurfaceHighlight(faceIndex: number): void;

  setDebugMode(mode: DebugMode): void;
  setBrightness(value: number): void;
  setGamma(value: number): void;
  setFullbright(enabled: boolean): void;
  setAmbient(value: number): void;
  setLightStyle(index: number, pattern: string | null): void;
  setUnderwaterWarp(enabled: boolean): void;
  setBloom(enabled: boolean): void;
  setBloomIntensity(value: number): void;
  setLodBias(bias: number): void;

  renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void;

  dispose(): void;
}

// WebGPU capability information
export interface WebGPUCapabilities {
  readonly maxTextureDimension2D: number;
  readonly maxTextureDimension3D: number;
  readonly maxTextureArrayLayers: number;
  readonly maxBindGroups: number;
  readonly maxDynamicUniformBuffersPerPipelineLayout: number;
  readonly maxDynamicStorageBuffersPerPipelineLayout: number;
  readonly maxSampledTexturesPerShaderStage: number;
  readonly maxSamplersPerShaderStage: number;
  readonly maxStorageBuffersPerShaderStage: number;
  readonly maxStorageTexturesPerShaderStage: number;
  readonly maxUniformBuffersPerShaderStage: number;
  readonly maxUniformBufferBindingSize: number;
  readonly maxStorageBufferBindingSize: number;
  readonly maxComputeWorkgroupSizeX: number;
  readonly maxComputeWorkgroupSizeY: number;
  readonly maxComputeWorkgroupSizeZ: number;
  readonly maxComputeInvocationsPerWorkgroup: number;
  readonly maxComputeWorkgroupsPerDimension: number;

  // Optional features
  readonly timestampQuery: boolean;
  readonly pipelineStatisticsQuery: boolean;
  readonly textureCompressionBC: boolean;
  readonly textureCompressionETC2: boolean;
  readonly textureCompressionASTC: boolean;
  readonly depthClipControl: boolean;
  readonly depth32floatStencil8: boolean;
}

// Compute pipeline for Phase 6
export interface ComputePipeline {
  readonly pipeline: GPUComputePipeline;
  readonly bindGroupLayout: GPUBindGroupLayout;
}

// Extended interface for WebGPU-specific features
export interface IWebGPURenderer extends IRenderer {
  readonly type: 'webgpu';
  readonly device: GPUDevice;

  // Compute shader dispatch (for Phase 6)
  dispatchCompute(
    pipeline: ComputePipeline,
    bindGroup: GPUBindGroup,
    workgroups: [number, number, number]
  ): void;

  // Query capabilities
  getCapabilities(): WebGPUCapabilities;

  // Performance timestamp queries (if supported)
  getTimestampResults?(): Promise<number[]>;

  // Debug utilities
  captureFrame?(): Promise<GPUCommandBuffer>;
}
