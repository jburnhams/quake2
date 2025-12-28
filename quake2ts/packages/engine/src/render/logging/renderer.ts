import type { IRenderer, Pic } from '../interface.js';
import type { FrameRenderOptions } from '../frame.js';
import type { RenderableEntity } from '../scene.js';
import { WebGLMatrixBuilder } from '../matrix/webgl.js';
import { WebGPUMatrixBuilder } from '../matrix/webgpu.js';
import { IdentityMatrixBuilder } from '../matrix/identity.js';
import { buildMatrices } from '../matrix/builders.js';
import { CoordinateSystem } from '../types/coordinates.js';
import type { MatrixBuilder } from '../matrix/builders.js';
import { quakeToWebGL, quakeToWebGPU } from '../matrix/transforms.js';
import type { Md2Model } from '../../assets/md2.js';
import type { Md3Model } from '../../assets/md3.js';
import type { InstanceData } from '../instancing.js';
import type { MemoryUsage } from '../types.js';
import type { RenderStatistics } from '../gpuProfiler.js';
import { DebugMode } from '../debugMode.js';
import { mat4, ReadonlyVec3 } from 'gl-matrix';

export interface LoggingRendererOptions {
  readonly targetSystem?: CoordinateSystem;
  readonly verbose?: boolean;
  readonly validateTransforms?: boolean;  // Catches double-transforms!
}

export class LoggingRenderer implements IRenderer {
  width = 0;
  height = 0;

  collisionVis = null as any;
  debug = null as any;
  particleSystem = null as any;

  private logs: string[] = [];
  private builder: MatrixBuilder;
  private options: Required<LoggingRendererOptions>;

  constructor(options: LoggingRendererOptions = {}) {
    this.options = {
      targetSystem: options.targetSystem ?? CoordinateSystem.QUAKE,
      verbose: options.verbose ?? true,
      validateTransforms: options.validateTransforms ?? true
    };

    // Select matrix builder based on target system
    switch (this.options.targetSystem) {
      case CoordinateSystem.OPENGL:
        this.builder = new WebGLMatrixBuilder();
        break;
      case CoordinateSystem.WEBGPU:
        this.builder = new WebGPUMatrixBuilder();
        break;
      default:
        this.builder = new IdentityMatrixBuilder();
    }

    this.log(`LoggingRenderer initialized (target=${this.options.targetSystem})`);
  }

  renderFrame(
    options: FrameRenderOptions,
    entities: readonly RenderableEntity[] = []
  ): void {
    this.log(`\n=== FRAME START ===`);

    // Extract camera state
    const cameraState = options.cameraState ?? options.camera.toState();
    this.log(`Camera State:`);
    this.log(`  Position: ${this.formatVec3(cameraState.position)} (Quake space)`);
    this.log(`  Angles:   ${this.formatVec3(cameraState.angles)} (degrees)`);
    this.log(`  FOV: ${cameraState.fov}°, Aspect: ${cameraState.aspect.toFixed(2)}`);

    // Build matrices
    const matrices = buildMatrices(this.builder, cameraState);
    this.log(`Matrices (${this.options.targetSystem}):`);
    if (this.options.verbose) {
      this.log(`  View Matrix:`);
      this.logMatrix(matrices.view);
      this.log(`  Projection Matrix:`);
      this.logMatrix(matrices.projection);
    }

    // Validate coordinate transforms if enabled
    if (this.options.validateTransforms) {
      this.validateCoordinateTransforms(cameraState, matrices.view);
    }

    // Log entities
    this.log(`Entities: ${entities.length}`);
    if (this.options.verbose && entities.length > 0) {
      entities.slice(0, 5).forEach((entity, i) => {
        this.log(`  [${i}] type=${entity.type}, model=${entity.model ?? 'none'}`);
      });
      if (entities.length > 5) {
        this.log(`  ... and ${entities.length - 5} more`);
      }
    }

    this.log(`=== FRAME END ===\n`);
  }

  private validateCoordinateTransforms(cameraState: any, viewMatrix: mat4): void {
    // Check for double-transform by verifying position embedding
    const quakePos = cameraState.position;
    const expectedGL = quakeToWebGL(quakePos);
    const expectedGPU = quakeToWebGPU(quakePos);

    // Extract translation from view matrix (last column)
    const matrixTranslation = [viewMatrix[12], viewMatrix[13], viewMatrix[14]];

    this.log(`Transform Validation:`);
    this.log(`  Quake position: ${this.formatVec3(quakePos)}`);

    switch (this.options.targetSystem) {
      case CoordinateSystem.OPENGL:
        this.log(`  Expected GL transform: ${this.formatVec3(expectedGL)}`);
        break;
      case CoordinateSystem.WEBGPU:
        this.log(`  Expected WebGPU transform: ${this.formatVec3(expectedGPU)}`);
        break;
    }

    this.log(`  Matrix translation: [${matrixTranslation.map(v => v.toFixed(2)).join(', ')}]`);

    // Warning if transforms look suspicious
    const posSum = Math.abs(quakePos[0]) + Math.abs(quakePos[1]) + Math.abs(quakePos[2]);
    const matSum = Math.abs(matrixTranslation[0]) + Math.abs(matrixTranslation[1]) + Math.abs(matrixTranslation[2]);
    if (posSum > 0 && matSum / posSum > 2.0) {
      this.log(`  ⚠️ WARNING: Matrix translation seems large relative to input - possible double-transform!`);
    }
  }

  private formatVec3(v: ReadonlyVec3 | number[] | Float32Array): string {
    return `[${v[0].toFixed(2)}, ${v[1].toFixed(2)}, ${v[2].toFixed(2)}]`;
  }

  private logMatrix(m: mat4): void {
    for (let row = 0; row < 4; row++) {
      const values = [m[row], m[row + 4], m[row + 8], m[row + 12]];
      this.log(`    [${values.map(v => v.toFixed(4).padStart(8)).join(' ')}]`);
    }
  }

  private log(message: string): void {
    this.logs.push(message);
    if (this.options.verbose) {
      console.log(`[LogRenderer] ${message}`);
    }
  }

  // Stub implementations (with logging)
  async registerPic(name: string, data: ArrayBuffer): Promise<Pic> {
    this.log(`registerPic("${name}", ${data.byteLength} bytes)`);
    return { width: 256, height: 256 } as Pic;
  }

  registerTexture(name: string, texture: any): Pic {
    this.log(`registerTexture("${name}", ${texture.width}x${texture.height})`);
    return { width: texture.width, height: texture.height } as Pic;
  }

  begin2D(): void { this.log('begin2D()'); }
  end2D(): void { this.log('end2D()'); }
  drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void {
    this.log(`drawPic(${x}, ${y})`);
  }
  drawString(x: number, y: number, text: string, color?: [number, number, number, number]): void {
    this.log(`drawString(${x}, ${y}, "${text}")`);
  }
  drawCenterString(y: number, text: string): void {
    this.log(`drawCenterString(${y}, "${text}")`);
  }
  drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void {
    this.log(`drawfillRect(${x}, ${y}, ${width}x${height})`);
  }

  // All other IRenderer methods as no-ops
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
      frameTimeMs: 0, gpuTimeMs: 0, cpuFrameTimeMs: 0,
      drawCalls: 0, triangles: 0, vertices: 0,
      textureBinds: 0, shaderSwitches: 0,
      visibleSurfaces: 0, culledSurfaces: 0,
      visibleEntities: 0, culledEntities: 0,
      memoryUsageMB: { textures: 0, geometry: 0, total: 0 }
    };
  }

  getMemoryUsage(): MemoryUsage {
    return {
      texturesBytes: 0, geometryBytes: 0,
      shadersBytes: 0, buffersBytes: 0, totalBytes: 0
    };
  }

  dispose(): void {
    this.log('dispose()');
  }

  // Test utilities
  getLogs(): readonly string[] {
    return this.logs;
  }

  resetLogs(): void {
    this.logs = [];
  }

  printLogs(): void {
    console.log(this.logs.join('\n'));
  }
}
