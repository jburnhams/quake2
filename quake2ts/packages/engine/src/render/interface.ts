// Shared renderer interfaces
// Extracted from original renderer.ts to support multiple backends

import { Vec3 } from '@quake2ts/shared';
import { Camera } from './camera.js';
import { RenderableEntity } from './scene.js';
import { Texture2D } from './resources.js';
import { PreparedTexture } from '../assets/texture.js';
import { CollisionVisRenderer } from './collisionVis.js';
import { DebugRenderer } from './debug.js';
import { ParticleSystem } from './particleSystem.js';
import { RenderStatistics } from './gpuProfiler.js';
import { MemoryUsage } from './types.js';
import { DebugMode } from './debugMode.js';
import { Md2Model } from '../assets/md2.js';
import { Md3Model } from '../assets/md3.js';
import { InstanceData } from './instancing.js';
import { FrameRenderOptions as FrameRenderOptionsType } from './frame.js';
import { RenderOptions as RenderOptionsType } from './options.js';

export type Pic = Texture2D;

export interface RenderOptions {
  clear?: boolean;
}

export type FrameRenderOptions = FrameRenderOptionsType;

export interface IRenderer {
  readonly width: number;
  readonly height: number;

  // These should probably be abstracted but kept for compatibility
  readonly collisionVis: CollisionVisRenderer;
  readonly debug: DebugRenderer;
  readonly particleSystem: ParticleSystem;

  getPerformanceReport(): RenderStatistics;
  getMemoryUsage(): MemoryUsage;

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[],
    renderOptions?: RenderOptionsType
  ): void;

  renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void;

  setDebugMode(mode: DebugMode): void;

  // Lighting
  setBrightness(value: number): void;
  setGamma(value: number): void;
  setFullbright(enabled: boolean): void;
  setAmbient(value: number): void;
  setLightStyle(index: number, pattern: string | null): void;

  // LOD
  setLodBias(bias: number): void;

  // HUD / 2D
  registerPic(name: string, data: ArrayBuffer): Promise<Pic>;
  registerTexture(name: string, texture: PreparedTexture): Pic;

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

  // Highlights
  setEntityHighlight(entityId: number, color: [number, number, number, number]): void;
  clearEntityHighlight(entityId: number): void;
  highlightSurface(faceIndex: number, color: [number, number, number, number]): void;
  removeSurfaceHighlight(faceIndex: number): void;

  // Post Process
  setUnderwaterWarp(enabled: boolean): void;
  setBloom(enabled: boolean): void;
  setBloomIntensity(value: number): void;

  dispose?(): void;

  // Debug/Dev properties
  readonly type?: 'webgl' | 'webgpu';
}

// Future WebGPU extension
export interface IWebGPURenderer extends IRenderer {
  readonly device: GPUDevice;
}
