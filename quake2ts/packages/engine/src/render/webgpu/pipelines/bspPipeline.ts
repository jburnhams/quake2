import {
  SURF_FLOWING,
  SURF_NONE,
  SURF_SKY,
  SURF_TRANS33,
  SURF_TRANS66,
  SURF_WARP,
  type SurfaceFlag,
} from '@quake2ts/shared';
import { DEFAULT_STYLE_INDICES, DEFAULT_STYLE_LAYERS, deriveSurfaceRenderState, resolveLightStyles, type SurfaceRenderState } from '../../utils/surface.js';
export type { SurfaceRenderState };
import { mat4, vec3, vec4 } from 'gl-matrix';
import { MAX_DLIGHTS, DLight } from '../../dlight.js';
import { BspSurfaceGeometry } from '../../bsp.js';
import { RenderModeConfig } from '../frame.js';
import bspShader from '../shaders/bsp.wgsl?raw';
import { Texture2D, createLinearSampler, Sampler } from '../resources.js';
import { CameraState } from '../../types/camera.js';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';

// Declare extensions locally for this file
declare module '../../bsp.js' {
    interface BspSurfaceGeometry {
        gpuVertexBuffer?: GPUBuffer;
        gpuIndexBuffer?: GPUBuffer;
        gpuWireframeIndexBuffer?: GPUBuffer;
        gpuWireframeIndexCount?: number;
    }
}

export interface BspSurfaceBindOptions {
  readonly modelViewProjection?: Float32List;
  readonly cameraState?: CameraState;
  readonly styleIndices?: readonly number[];
  readonly styleValues?: ReadonlyArray<number>;
  readonly styleLayers?: readonly number[];
  readonly diffuseTexture?: GPUTextureView;
  readonly diffuseSampler?: GPUSampler;
  readonly lightmapTexture?: GPUTextureView;
  readonly lightmapSampler?: GPUSampler;
  readonly surfaceFlags?: SurfaceFlag;
  readonly timeSeconds?: number;
  readonly texScroll?: readonly [number, number];
  readonly alpha?: number;
  readonly warp?: boolean;
  readonly dlights?: readonly DLight[];
  readonly renderMode?: RenderModeConfig;
  readonly lightmapOnly?: boolean;
  readonly brightness?: number;
  readonly gamma?: number;
  readonly fullbright?: boolean;
  readonly ambient?: number;
  readonly cameraPosition?: Float32List;
  /** Model matrix for a brush model (a door at its entity's position); identity for the world. */
  readonly modelMatrix?: Float32List;
}

/** One draw's surface uniforms; 256 is WebGPU's minUniformBufferOffsetAlignment default. */
const SURFACE_SLOT_BYTES = 256;
/** SurfaceUniforms in bsp.wgsl: 112 bytes of fields, then the model matrix. */
const SURFACE_FLOATS = 28 + 16;
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);


export class BspSurfacePipeline {
  private device: GPUDevice;
  private pipeline!: GPURenderPipeline;
  private pipelineWireframe!: GPURenderPipeline;
  private frameUniformBuffer: GPUBuffer;
  // Per-draw surface uniforms live in one buffer, one 256-byte slot per draw, bound with a
  // dynamic offset. queue.writeBuffer runs before the pass executes, so a single slot rewritten
  // per draw would leave every draw with the last surface's values.
  private surfaceUniformBuffer: GPUBuffer;
  private surfaceBindGroup!: GPUBindGroup;
  private surfaceSlotCapacity = 1024;
  private surfaceSlot = 0;
  private textureBindGroups = new WeakMap<GPUTextureView, WeakMap<GPUTextureView, WeakMap<GPUSampler, GPUBindGroup>>>();
  private frameBindGroup!: GPUBindGroup;
  private frameBindGroupLayout: GPUBindGroupLayout;
  private surfaceBindGroupLayout: GPUBindGroupLayout;
  private textureBindGroupLayout: GPUBindGroupLayout;
  private matrixBuilder: WebGPUMatrixBuilder;

  // Default resources
  private defaultWhiteTexture: Texture2D;
  private defaultSampler: Sampler;
  private defaultBindGroup: GPUBindGroup;
  private defaultWhiteView!: GPUTextureView;

  // Cache for texture bind groups

  constructor(device: GPUDevice, format: GPUTextureFormat, depthFormat: GPUTextureFormat) {
    this.device = device;
    this.matrixBuilder = new WebGPUMatrixBuilder();

    // Buffer sizes
    // Frame: MVP(64) + CamPos(16) + Time/Params(32) + Lights(32 * 32 = 1024) -> ~1136 bytes -> Round to 1280 or similar multiple of 256
    const frameBufferSize = 2048; // Safe margin
    // Surface: Scroll(8) + LMScroll(8) + Styles(16) + LayerMapping(16) + SolidColor(16) + Params(16) -> ~80 bytes -> 256 aligned
    const surfaceBufferSize = 256;

    this.frameUniformBuffer = device.createBuffer({
      size: frameBufferSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.surfaceUniformBuffer = device.createBuffer({
      size: surfaceBufferSize * this.surfaceSlotCapacity,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Bind Group Layouts
    this.frameBindGroupLayout = device.createBindGroupLayout({
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }],
    });

    this.surfaceBindGroupLayout = device.createBindGroupLayout({
      entries: [{
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: SURFACE_SLOT_BYTES },
      }],
    });

    this.textureBindGroupLayout = device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
        { binding: 2, visibility: GPUShaderStage.FRAGMENT, texture: {} },
        { binding: 3, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      ],
    });

    // Create Default Resources
    this.defaultSampler = createLinearSampler(device);
    this.defaultWhiteTexture = new Texture2D(device, {
        width: 1,
        height: 1,
        format: 'rgba8unorm',
        label: 'bsp-default-white'
    });
    this.defaultWhiteTexture.upload(new Uint8Array([255, 255, 255, 255]));
    this.defaultWhiteView = this.defaultWhiteTexture.createView();

    // Create default bind group
    this.defaultBindGroup = device.createBindGroup({
        layout: this.textureBindGroupLayout,
        entries: [
            { binding: 0, resource: this.defaultWhiteTexture.createView() },
            { binding: 1, resource: this.defaultSampler.sampler },
            { binding: 2, resource: this.defaultWhiteTexture.createView() }, // Use white texture as lightmap fallback
            { binding: 3, resource: this.defaultSampler.sampler },
        ]
    });

    this.createPipelines(format, depthFormat);

    // Initial Bind Groups
    this.frameBindGroup = device.createBindGroup({
      layout: this.frameBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.frameUniformBuffer } }],
    });
    this.surfaceBindGroup = this.createSurfaceBindGroup();
  }

  private createSurfaceBindGroup(): GPUBindGroup {
    return this.device.createBindGroup({
      layout: this.surfaceBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.surfaceUniformBuffer, size: SURFACE_SLOT_BYTES } }],
    });
  }

  /** Starts a frame: surface uniform slots are reused from the start. */
  beginFrame(): void {
    this.surfaceSlot = 0;
  }

  /** Takes the next per-draw uniform slot, growing the buffer when a frame needs more draws. */
  private takeSurfaceSlot(): number {
    if (this.surfaceSlot >= this.surfaceSlotCapacity) {
      // Earlier draws in this frame still reference the old buffer, so it is left to be
      // collected rather than destroyed. Slots already written there stay valid.
      this.surfaceSlotCapacity *= 2;
      this.surfaceUniformBuffer = this.device.createBuffer({
        size: SURFACE_SLOT_BYTES * this.surfaceSlotCapacity,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      this.surfaceBindGroup = this.createSurfaceBindGroup();
    }
    return this.surfaceSlot++;
  }

  private textureBindGroup(diffuse: GPUTextureView, diffuseSampler: GPUSampler, lightmap: GPUTextureView, lightmapSampler: GPUSampler): GPUBindGroup {
    let byLightmap = this.textureBindGroups.get(diffuse);
    if (!byLightmap) this.textureBindGroups.set(diffuse, (byLightmap = new WeakMap()));
    let bySampler = byLightmap.get(lightmap);
    if (!bySampler) byLightmap.set(lightmap, (bySampler = new WeakMap()));
    let group = bySampler.get(diffuseSampler);
    if (!group) {
      group = this.device.createBindGroup({
        layout: this.textureBindGroupLayout,
        entries: [
          { binding: 0, resource: diffuse },
          { binding: 1, resource: diffuseSampler },
          { binding: 2, resource: lightmap },
          { binding: 3, resource: lightmapSampler },
        ],
      });
      bySampler.set(diffuseSampler, group);
    }
    return group;
  }

  private createPipelines(format: GPUTextureFormat, depthFormat: GPUTextureFormat) {
    const module = this.device.createShaderModule({
      code: bspShader,
    });

    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [
        this.frameBindGroupLayout,
        this.surfaceBindGroupLayout,
        this.textureBindGroupLayout
      ],
    });

    const vertexState: GPUVertexState = {
      module,
      entryPoint: 'vertexMain',
      buffers: [
        {
          // Interleaved buffer: pos(3), tex(2), lm(2), step(1) -> 8 floats -> 32 bytes
          arrayStride: 32,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' }, // Position
            { shaderLocation: 1, offset: 12, format: 'float32x2' }, // TexCoord
            { shaderLocation: 2, offset: 20, format: 'float32x2' }, // LightmapCoord
            { shaderLocation: 3, offset: 28, format: 'float32' },   // LightmapStep
          ],
        },
      ],
    };

    // Standard Pipeline
    this.pipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: vertexState,
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format,
          blend: {
            color: {
              srcFactor: 'src-alpha',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
            alpha: {
              srcFactor: 'one',
              dstFactor: 'one-minus-src-alpha',
              operation: 'add',
            },
          },
        }],
      },
      primitive: {
        topology: 'triangle-list',
        // No culling, matching the WebGL backend. On demo1, frontFace 'cw' with back culling
        // gives the identical image (BSP faces wind clockwise seen from the front), but the
        // synthetic pipeline tests draw counter-clockwise quads; culling comes with the shared
        // draw list, where both backends get it at once.
        cullMode: 'none',
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });

    // Wireframe Pipeline
    this.pipelineWireframe = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: vertexState,
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{ format, writeMask: GPUColorWrite.ALL }],
      },
      primitive: {
        topology: 'line-list',
      },
      depthStencil: {
        format: depthFormat,
        depthWriteEnabled: true,
        depthCompare: 'less',
      },
    });
  }

  bind(passEncoder: GPURenderPassEncoder, options: BspSurfaceBindOptions): SurfaceRenderState {
    const {
      modelViewProjection,
      cameraState,
      styleIndices = DEFAULT_STYLE_INDICES,
      styleLayers = DEFAULT_STYLE_LAYERS,
      styleValues = [],
      diffuseTexture,
      diffuseSampler,
      lightmapTexture,
      lightmapSampler,
      surfaceFlags = SURF_NONE,
      timeSeconds = 0,
      texScroll,
      alpha,
      warp,
      dlights = [],
      renderMode,
      lightmapOnly,
      brightness = 1.0,
      gamma = 1.0,
      fullbright = false,
      ambient = 0.0,
      cameraPosition = [0,0,0],
      modelMatrix = IDENTITY,
    } = options;

    let viewProjection: Float32List;

    if (cameraState) {
        const projection = this.matrixBuilder.buildProjectionMatrix(cameraState);
        const view = this.matrixBuilder.buildViewMatrix(cameraState);
        const vp = mat4.create();
        mat4.multiply(vp, projection, view);
        viewProjection = vp as Float32Array;
    } else if (modelViewProjection) {
        viewProjection = modelViewProjection;
    } else {
        throw new Error('BspSurfacePipeline.bind: either cameraState or modelViewProjection must be provided');
    }

    const state = deriveSurfaceRenderState(surfaceFlags, timeSeconds);
    const styles = resolveLightStyles(styleIndices, styleValues);

    const finalScrollX = texScroll ? texScroll[0] : state.flowOffset[0];
    const finalScrollY = texScroll ? texScroll[1] : state.flowOffset[1];
    const finalAlpha = alpha !== undefined ? alpha : state.alpha;
    const finalWarp = warp !== undefined ? warp : state.warp;

    // Update Frame Uniforms (Ideally done once per frame, but here we do it per bind for API compat)
    // Optimization: Check if frame uniforms changed before writing
    const frameData = new Float32Array(512); // Enough for header + lights
    frameData.set(viewProjection as Float32Array, 0); // 0-15
    frameData.set(cameraPosition as Float32Array, 16); // 16-18
    frameData[19] = 0; // Padding
    frameData[20] = timeSeconds;
    frameData[21] = brightness;
    frameData[22] = gamma;
    frameData[23] = ambient;

    const numDlights = Math.min(dlights.length, MAX_DLIGHTS);
    const numDlightsView = new Uint32Array(frameData.buffer, 24 * 4, 1);
    numDlightsView[0] = numDlights;

    const fullbrightView = new Uint32Array(frameData.buffer, 25 * 4, 1);
    fullbrightView[0] = fullbright ? 1 : 0;

    // Padding at 26, 27

    // Lights start at offset 32 (128 bytes) in the struct
    // Each light is 32 bytes (8 floats)
    let lightOffset = 32;
    for (let i = 0; i < numDlights; i++) {
        const l = dlights[i];
        frameData[lightOffset + 0] = l.origin.x;
        frameData[lightOffset + 1] = l.origin.y;
        frameData[lightOffset + 2] = l.origin.z;
        frameData[lightOffset + 3] = l.intensity;
        frameData[lightOffset + 4] = l.color.x;
        frameData[lightOffset + 5] = l.color.y;
        frameData[lightOffset + 6] = l.color.z;
        frameData[lightOffset + 7] = 0; // Padding
        lightOffset += 8;
    }

    this.device.queue.writeBuffer(this.frameUniformBuffer, 0, frameData, 0, lightOffset);

    // Update Surface Uniforms
    const surfaceData = new Float32Array(SURFACE_FLOATS);
    surfaceData[0] = finalScrollX;
    surfaceData[1] = finalScrollY;
    surfaceData[2] = state.flowOffset[0]; // lightmap scroll
    surfaceData[3] = state.flowOffset[1];
    surfaceData.set(styles, 4); // 4-7
    surfaceData.set(styleLayers as number[], 8); // 8-11

    // Render Mode Logic
    let modeInt = 0; // Textured
    let color = [1, 1, 1, 1];

    if (renderMode) {
      if (renderMode.mode === 'solid' || renderMode.mode === 'wireframe') {
          modeInt = 1; // Solid
      } else if (renderMode.mode === 'solid-faceted') {
          modeInt = 2; // Faceted
      } else if (renderMode.mode === 'worldpos-debug') {
          modeInt = 3; // Debug: output worldPos as color
      } else if (renderMode.mode === 'distance-debug') {
          modeInt = 4; // Debug: output distance to first dlight as grayscale
      }

      if (renderMode.color) {
          color = [...renderMode.color];
      } else if (renderMode.generateRandomColor) {
         color = [1, 1, 1, 1];
      }
    }

    surfaceData.set(color, 12); // 12-15
    surfaceData[16] = finalAlpha;

    const surfaceUint = new Uint32Array(surfaceData.buffer);
    const applyLightmap = !state.sky && lightmapTexture !== undefined && !finalWarp;
    surfaceUint[17] = applyLightmap ? 1 : 0;
    surfaceUint[18] = finalWarp ? 1 : 0;
    surfaceUint[19] = lightmapOnly ? 1 : 0;
    surfaceUint[20] = modeInt;
    // WGSL layout: renderMode at byte 80, pad0 (vec3) at 96, model (mat4x4, 16-aligned) at 112.
    surfaceData.set(modelMatrix as ArrayLike<number>, 28);

    const slot = this.takeSurfaceSlot();
    this.device.queue.writeBuffer(this.surfaceUniformBuffer, slot * SURFACE_SLOT_BYTES, surfaceData);

    // Texture bind group: a missing diffuse or lightmap falls back to white, so a lightmapped
    // surface whose texture failed to load still shows its light, and the reverse.
    if (diffuseTexture || lightmapTexture) {
        passEncoder.setBindGroup(2, this.textureBindGroup(
            diffuseTexture ?? this.defaultWhiteView,
            diffuseSampler ?? this.defaultSampler.sampler,
            lightmapTexture ?? this.defaultWhiteView,
            lightmapSampler ?? this.defaultSampler.sampler,
        ));
    } else {
        passEncoder.setBindGroup(2, this.defaultBindGroup);
    }

    // Set Pipeline
    const pipeline = (renderMode && renderMode.mode === 'wireframe') ? this.pipelineWireframe : this.pipeline;
    passEncoder.setPipeline(pipeline);
    passEncoder.setBindGroup(0, this.frameBindGroup);
    passEncoder.setBindGroup(1, this.surfaceBindGroup, [slot * SURFACE_SLOT_BYTES]);

    return state;
  }

  draw(
    passEncoder: GPURenderPassEncoder,
    geometry: { readonly gpuVertexBuffer?: GPUBuffer; readonly gpuIndexBuffer?: GPUBuffer; readonly indexCount: number },
    renderMode?: RenderModeConfig
  ): void {
      if (!geometry.gpuIndexBuffer) return; // Need GPU buffers

      if (renderMode && renderMode.mode === 'wireframe') {
          // TODO: Implement wireframe index buffer generation/upload for WebGPU if needed
          // For now, skip or fallback
      } else {
          passEncoder.setVertexBuffer(0, geometry.gpuVertexBuffer!);
          passEncoder.setIndexBuffer(geometry.gpuIndexBuffer, 'uint16');
          passEncoder.drawIndexed(geometry.indexCount);
      }
  }

  destroy(): void {
    this.frameUniformBuffer.destroy();
    this.surfaceUniformBuffer.destroy();
    this.defaultWhiteTexture.destroy();
    // Pipelines, layouts, and bind groups are generally collected by the device,
    // but we can release references or if needed explicit destroy (if API supported, typically destroy() is on device/buffer/texture/querySet)
    // Pipeline layouts don't have destroy.
  }
}
