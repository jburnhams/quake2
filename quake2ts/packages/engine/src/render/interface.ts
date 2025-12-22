import { RenderableEntity } from './scene.js';
import { Vec3 } from '@quake2ts/shared';
import { PreparedTexture } from '../assets/texture.js';
import { DebugMode } from './debugMode.js';

// Re-export common types that were previously in renderer.ts or implicit
export interface RenderOptions {
  /**
   * If true, debug visualization (wireframes, bounds) is enabled.
   */
  readonly debug?: boolean;
  /**
   * Override the culling behavior (e.g. disable PVS).
   */
  readonly noCull?: boolean;

  readonly wireframe?: boolean;
  readonly showLightmaps?: boolean; // If false, lightmaps are disabled (fullbright or diffuse only)
  readonly showSkybox?: boolean;
  readonly showBounds?: boolean;
  readonly showNormals?: boolean;
  readonly cullingEnabled?: boolean;
}

// We use 'any' for the renderer-specific options to decouple them here
// Real implementations will cast this to their specific FrameRenderOptions
export interface FrameRenderOptions {
  [key: string]: any;
}

/**
 * Common interface for all renderer implementations (WebGL2, WebGPU).
 */
export interface IRenderer {
  readonly width: number;
  readonly height: number;

  /**
   * Main entry point to render a 3D frame.
   */
  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[],
    renderOptions?: RenderOptions
  ): void;

  registerPic(name: string, data: ArrayBuffer): Promise<any>;
  registerTexture(name: string, texture: PreparedTexture): any;

  /**
   * Prepare for 2D rendering (HUD, menus).
   */
  begin2D(): void;

  /**
   * Draw a 2D image (texture/sprite).
   */
  drawPic(
    x: number,
    y: number,
    w: number,
    h: number,
    pic: any, // Using any for now to avoid circular dependency on Pic
    color?: [number, number, number, number]
  ): void;

  // Convenience overload matching legacy usage without w/h (assumes pic width/height or similar?)
  // Actually, standard usage in this engine seems to require w/h.
  // The errors in client show Expected 5-6 arguments, but got 3 or 4.
  // This means callers are calling drawPic(x, y, pic, color?).
  // We need to support that.
  drawPic(
    x: number,
    y: number,
    pic: any,
    color?: [number, number, number, number]
  ): void;

  /**
   * Draw a colored rectangle.
   */
  drawfillRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: [number, number, number, number] | number // Accept both for now to support legacy
  ): void;

  /**
   * Draw a string of text.
   */
  drawString(
    x: number,
    y: number,
    str: string,
    color?: [number, number, number, number]
  ): void;

  drawCenterString(
    y: number,
    str: string
  ): void;

  /**
   * Finish 2D rendering pass.
   */
  end2D(): void;

  setBrightness(value: number): void;
  setGamma(value: number): void;
  setFullbright(enabled: boolean): void;
  setAmbient(value: number): void;
  setLightStyle(index: number, pattern: string | null): void;
  setUnderwaterWarp(enabled: boolean): void;
  setBloom(enabled: boolean): void;
  setBloomIntensity(value: number): void;
  setDebugMode(mode: DebugMode): void;

  getPerformanceReport(): any;
  getMemoryUsage(): any;

  // Particle system exposure needed for effects-system.ts
  readonly particleSystem: any;

  // Collision visualization
  readonly collisionVis: any;

  // Debug renderer
  readonly debug: any;

  // Instancing support (legacy, will be refactored)
  renderInstanced(model: any, instances: any[]): void;

  // Highlighting support (legacy)
  setEntityHighlight(entityId: number, color: [number, number, number, number]): void;
  clearEntityHighlight(entityId: number): void;
  highlightSurface(faceIndex: number, color: [number, number, number, number]): void;
  removeSurfaceHighlight(faceIndex: number): void;

  setLodBias(bias: number): void;

  /**
   * Release all resources.
   */
  dispose(): void;
}
