import { Vec3 } from '@quake2ts/shared';
import { DebugPipeline, Color } from './pipelines/debug.js';
import { IDebugRenderer } from '../interface.js';

/**
 * WebGPU-compatible DebugRenderer wrapper
 * Provides the same API as the WebGL DebugRenderer but uses WebGPU pipelines internally
 */
export class WebGPUDebugRenderer implements IDebugRenderer {
  private pipeline: DebugPipeline;

  constructor(
    device: GPUDevice,
    format: GPUTextureFormat,
    depthFormat: GPUTextureFormat = 'depth24plus'
  ) {
    this.pipeline = new DebugPipeline(device, format, depthFormat);
  }

  // =========================================================================
  // Drawing API (compatible with WebGL DebugRenderer)
  // =========================================================================

  drawLine(start: Vec3, end: Vec3, color: Color): void {
    this.pipeline.drawLine(start, end, color);
  }

  drawBoundingBox(mins: Vec3, maxs: Vec3, color: Color): void {
    this.pipeline.drawBoundingBox(mins, maxs, color);
  }

  drawPoint(position: Vec3, size: number, color: Color): void {
    this.pipeline.drawPoint(position, size, color);
  }

  drawAxes(position: Vec3, size: number): void {
    this.pipeline.drawAxes(position, size);
  }

  drawText3D(text: string, position: Vec3): void {
    this.pipeline.drawText3D(text, position);
  }

  addCone(apex: Vec3, baseCenter: Vec3, baseRadius: number, color: Color): void {
    this.pipeline.addCone(apex, baseCenter, baseRadius, color);
  }

  addTorus(
    center: Vec3,
    radius: number,
    tubeRadius: number,
    color: Color,
    axis: Vec3 = { x: 0, y: 0, z: 1 }
  ): void {
    this.pipeline.addTorus(center, radius, tubeRadius, color, axis);
  }

  // =========================================================================
  // Rendering (WebGPU-specific)
  // =========================================================================

  /**
   * Render debug geometry to the given render pass
   * @param pass - The active render pass encoder
   * @param viewProjection - The view-projection matrix
   * @param alwaysOnTop - Whether to render on top of everything (requires separate pipeline)
   */
  render(
    pass: GPURenderPassEncoder,
    viewProjection: Float32Array,
    alwaysOnTop: boolean = false
  ): void {
    this.pipeline.render(pass, viewProjection, alwaysOnTop);
  }

  /**
   * Get 3D text labels projected to 2D screen space
   * @param viewProjection - The view-projection matrix
   * @param width - Viewport width
   * @param height - Viewport height
   * @returns Array of labels with screen positions
   */
  getLabels(
    viewProjection: Float32Array,
    width: number,
    height: number
  ): { text: string; x: number; y: number }[] {
    return this.pipeline.getLabels(viewProjection, width, height);
  }

  /**
   * Clear all accumulated debug geometry
   */
  clear(): void {
    this.pipeline.clear();
  }

  /**
   * Destroy all GPU resources
   */
  destroy(): void {
    this.pipeline.destroy();
  }

  // =========================================================================
  // Properties (for compatibility with interface)
  // =========================================================================

  get shaderSize(): number {
    // WebGPU shaders are compiled differently, return approximate size
    // This is mainly for debugging/profiling purposes
    return 2048; // Approximate size of both line and solid shaders
  }
}
