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

// Pic can be either WebGL or WebGPU texture
export type Pic = WebGLTexture2D | {
  readonly width: number;
  readonly height: number;
  readonly texture?: GPUTexture;
  upload?: (data: BufferSource, options?: any) => void;
  destroy?: () => void;
};

export interface IRenderer {
  width: number;
  height: number;
  collisionVis: CollisionVisRenderer;
  debug: DebugRenderer;
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
