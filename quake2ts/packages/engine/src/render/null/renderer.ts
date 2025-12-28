import type { IRenderer, Pic } from '../interface.js';
import type { FrameRenderOptions } from '../frame.js';
import type { RenderableEntity } from '../scene.js';
import { DebugMode } from '../debugMode.js';
import type { Md2Model } from '../../assets/md2.js';
import type { Md3Model } from '../../assets/md3.js';
import type { InstanceData } from '../instancing.js';
import type { MemoryUsage } from '../types.js';
import type { RenderStatistics } from '../gpuProfiler.js';

export class NullRenderer implements IRenderer {
  width = 0;
  height = 0;

  collisionVis = null as any;
  debug = null as any;
  particleSystem = null as any;

  private frameCount = 0;
  private callLog: string[] = [];

  constructor(width: number = 800, height: number = 600) {
    this.width = width;
    this.height = height;
  }

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[] = []
  ): void {
    this.frameCount++;
    this.callLog.push(`renderFrame(frame=${this.frameCount}, entities=${entities.length})`);

    // Validate CameraState is available
    const cameraState = options.cameraState ?? options.camera.toState();
    this.callLog.push(`  camera: pos=${cameraState.position}, angles=${cameraState.angles}`);
  }

  // Stub implementations (all no-op)
  async registerPic(name: string, data: ArrayBuffer): Promise<Pic> {
    this.callLog.push(`registerPic(${name})`);
    return { width: 256, height: 256 } as Pic;
  }

  registerTexture(name: string, texture: any): Pic {
    this.callLog.push(`registerTexture(${name})`);
    return { width: texture.width, height: texture.height } as Pic;
  }

  begin2D(): void {
    this.callLog.push('begin2D()');
  }

  end2D(): void {
    this.callLog.push('end2D()');
  }

  drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void {
    this.callLog.push(`drawPic(${x}, ${y})`);
  }

  drawString(x: number, y: number, text: string, color?: [number, number, number, number]): void {
    this.callLog.push(`drawString(${x}, ${y}, "${text}")`);
  }

  drawCenterString(y: number, text: string): void {
    this.callLog.push(`drawCenterString(${y}, "${text}")`);
  }

  drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void {
    this.callLog.push(`drawfillRect(${x}, ${y}, ${width}, ${height})`);
  }

  setEntityHighlight(entityId: number, color: [number, number, number, number]): void {}
  clearEntityHighlight(entityId: number): void {}
  highlightSurface(faceIndex: number, color: [number, number, number, number]): void {}
  removeSurfaceHighlight(faceIndex: number): void {}
  setDebugMode(mode: DebugMode): void {}
  setBrightness(value: number): void {}
  setGamma(value: number): void {}
  setFullbright(enabled: boolean): void {}
  setAmbient(value: number): void {}
  setLightStyle(index: number, pattern: string | null): void {}
  setUnderwaterWarp(enabled: boolean): void {}
  setBloom(enabled: boolean): void {}
  setBloomIntensity(value: number): void {}
  setLodBias(bias: number): void {}
  renderInstanced(model: Md2Model | Md3Model, instances: InstanceData[]): void {}

  getPerformanceReport(): RenderStatistics {
    return {
      frameTimeMs: 0,
      gpuTimeMs: 0,
      cpuFrameTimeMs: 0,
      drawCalls: 0,
      triangles: 0,
      vertices: 0,
      textureBinds: 0,
      shaderSwitches: 0,
      visibleSurfaces: 0,
      culledSurfaces: 0,
      visibleEntities: 0,
      culledEntities: 0,
      memoryUsageMB: { textures: 0, geometry: 0, total: 0 }
    };
  }

  getMemoryUsage(): MemoryUsage {
    return {
      texturesBytes: 0,
      geometryBytes: 0,
      shadersBytes: 0,
      buffersBytes: 0,
      totalBytes: 0
    };
  }

  dispose(): void {
    this.callLog.push('dispose()');
  }

  // Test utilities
  getCallLog(): readonly string[] {
    return this.callLog;
  }

  resetCallLog(): void {
    this.callLog = [];
  }

  getFrameCount(): number {
    return this.frameCount;
  }
}
