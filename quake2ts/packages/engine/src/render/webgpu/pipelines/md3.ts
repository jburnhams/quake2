import { Mat4, Vec3, mat4FromBasis, normalizeVec3, transformPointMat4, createMat4Identity, multiplyMat4, mat4Identity } from '@quake2ts/shared';
import { Md3Model, Md3Surface } from '../../../assets/md3.js';
import { Md3LightingOptions, Md3FrameBlend, Md3SurfaceGeometry, buildMd3SurfaceGeometry, buildMd3VertexData, Md3TagTransform, interpolateMd3Tag } from '../../md3Pipeline.js';
import { Texture2D } from '../resources.js';
import { WebGPUContextState } from '../context.js';
import md3Shader from '../shaders/md3.wgsl?raw';
import { mat4 } from 'gl-matrix';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';
import { CameraState } from '../../types/camera.js';

// Re-export common types from WebGL pipeline
export { Md3FrameBlend, Md3LightingOptions, Md3DynamicLight, Md3TagTransform } from '../../md3Pipeline.js';

export class Md3SurfaceMeshGPU {
  readonly device: GPUDevice;
  readonly geometry: Md3SurfaceGeometry;
  readonly vertexBuffer: GPUBuffer;
  readonly indexBuffer: GPUBuffer;
  readonly indexCount: number;

  constructor(device: GPUDevice, surface: Md3Surface, blend: Md3FrameBlend, lighting?: Md3LightingOptions) {
    this.device = device;
    this.geometry = buildMd3SurfaceGeometry(surface);
    this.indexCount = this.geometry.indices.length;

    // Create Index Buffer
    // 2 bytes per index (Uint16)
    // Align to 4 bytes if necessary, but WebGPU usually fine with Uint16 index buffer
    const indices = this.geometry.indices;
    const indexBufferSize = (indices.byteLength + 3) & ~3; // Align to 4

    // Ensure size is valid (non-zero) and multiple of 4
    const safeIndexBufferSize = Math.max(4, indexBufferSize);

    this.indexBuffer = device.createBuffer({
      label: `md3-surface-${surface.name}-indices`,
      size: safeIndexBufferSize,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });

    if (indices.byteLength > 0) {
        const mappedRange = this.indexBuffer.getMappedRange();
        const targetView = new Uint16Array(mappedRange, 0, indices.length);
        targetView.set(indices);
    }

    this.indexBuffer.unmap();

    // Create Vertex Buffer
    // Vertex size = 12 floats * 4 bytes = 48 bytes
    // vertices count = geometry.vertices.length
    const vertexCount = this.geometry.vertices.length;
    this.vertexBuffer = device.createBuffer({
      label: `md3-surface-${surface.name}-vertices`,
      size: Math.max(4, vertexCount * 48),
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.update(surface, blend, lighting);
  }

  update(surface: Md3Surface, blend: Md3FrameBlend, lighting?: Md3LightingOptions): void {
    const data = buildMd3VertexData(surface, this.geometry, blend, lighting);
    this.device.queue.writeBuffer(this.vertexBuffer, 0, data as unknown as ArrayBuffer);
  }

  destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
  }
}

export class Md3ModelMeshGPU {
  readonly surfaces = new Map<string, Md3SurfaceMeshGPU>();
  readonly device: GPUDevice;
  readonly model: Md3Model;
  blend: Md3FrameBlend;
  lighting?: Md3LightingOptions;

  constructor(device: GPUDevice, model: Md3Model, blend: Md3FrameBlend, lighting?: Md3LightingOptions) {
    this.device = device;
    this.model = model;
    this.blend = blend;
    this.lighting = lighting;

    model.surfaces.forEach((surface) => {
      this.surfaces.set(surface.name, new Md3SurfaceMeshGPU(device, surface, blend, lighting));
    });
  }

  update(blend: Md3FrameBlend, lighting?: Md3LightingOptions): void {
    this.blend = blend;
    this.lighting = lighting ?? this.lighting;
    for (const surface of this.model.surfaces) {
      const mesh = this.surfaces.get(surface.name);
      mesh?.update(surface, blend, this.lighting);
    }
  }

  destroy(): void {
    for (const mesh of this.surfaces.values()) {
      mesh.destroy();
    }
    this.surfaces.clear();
  }
}

export interface Md3MaterialGPU {
  readonly diffuseTexture: Texture2D;
  readonly tint?: readonly [number, number, number, number];
}

export class Md3PipelineGPU {
  private pipeline: GPURenderPipeline;
  private bindGroupLayout: GPUBindGroupLayout;
  private uniformBuffer: GPUBuffer;
  private sampler: GPUSampler;
  private matrixBuilder: WebGPUMatrixBuilder;
  private tempVpMatrix: mat4 = mat4.create(); // Reused to avoid GC pressure

  constructor(private device: GPUDevice, private format: GPUTextureFormat) {
    this.matrixBuilder = new WebGPUMatrixBuilder();
    const module = device.createShaderModule({
      label: 'md3-shader',
      code: md3Shader
    });

    this.uniformBuffer = device.createBuffer({
        label: 'md3-uniform-buffer',
        size: 256, // Padded to minUniformBufferOffsetAlignment usually 256
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    this.sampler = device.createSampler({
        label: 'md3-sampler',
        minFilter: 'linear',
        magFilter: 'linear',
        addressModeU: 'repeat',
        addressModeV: 'repeat'
    });

    this.bindGroupLayout = device.createBindGroupLayout({
        label: 'md3-bind-group-layout',
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { viewDimension: '2d' }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
            }
        ]
    });

    this.pipeline = device.createRenderPipeline({
      label: 'md3-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout]
      }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 48,
          attributes: [
            { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
            { shaderLocation: 1, offset: 12, format: 'float32x3' }, // normal (unused in shader currently but available)
            { shaderLocation: 2, offset: 24, format: 'float32x2' }, // uv
            { shaderLocation: 3, offset: 32, format: 'float32x3' }  // color (vertex lighting)
          ]
        }]
      },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format,
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
              }
          }
        }]
      },
      depthStencil: {
        format: 'depth24plus',
        depthWriteEnabled: true,
        depthCompare: 'less'
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'back'
      }
    });
  }

  draw(passEncoder: GPURenderPassEncoder,
       mesh: Md3SurfaceMeshGPU,
       material: Md3MaterialGPU,
       viewProjection: Float32Array,
       modelMatrix: Float32Array,
       tint: Float32Array = new Float32Array([1, 1, 1, 1]),
       cameraState?: CameraState
  ): void {
      const uniformData = new Float32Array(40);
      // viewProjection (16 floats) = 64 bytes
      // modelMatrix (16 floats) = 64 bytes
      // tint (4 floats) = 16 bytes
      // Total 144 bytes < 256.
      // We need to match struct layout in shader.
      // struct Uniforms {
      //   viewProjection: mat4x4<f32>, (0-63)
      //   modelMatrix: mat4x4<f32>,    (64-127)
      //   tint: vec4<f32>,             (128-143)
      // };

      // Use CameraState if provided (native WebGPU coordinate system)
      let finalViewProj: Float32Array = viewProjection;
      if (cameraState) {
        const view = this.matrixBuilder.buildViewMatrix(cameraState);
        const proj = this.matrixBuilder.buildProjectionMatrix(cameraState);
        mat4.multiply(this.tempVpMatrix, proj, view);
        finalViewProj = this.tempVpMatrix as Float32Array;
      }

      uniformData.set(finalViewProj, 0);
      uniformData.set(modelMatrix, 16);
      uniformData.set(tint, 32);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData as unknown as ArrayBuffer);

      const bindGroup = this.device.createBindGroup({
          layout: this.bindGroupLayout,
          entries: [
              { binding: 0, resource: { buffer: this.uniformBuffer } },
              { binding: 1, resource: material.diffuseTexture.createView() },
              { binding: 2, resource: this.sampler }
          ]
      });

      passEncoder.setPipeline(this.pipeline);
      passEncoder.setBindGroup(0, bindGroup);
      passEncoder.setVertexBuffer(0, mesh.vertexBuffer);
      passEncoder.setIndexBuffer(mesh.indexBuffer, 'uint16');
      passEncoder.drawIndexed(mesh.indexCount);
  }

  getAttachmentMatrix(
      parentModel: Md3Model,
      parentBlend: Md3FrameBlend,
      tagName: string,
      parentModelMatrix: Float32Array
  ): Float32Array | null {
      const tagTransform = interpolateMd3Tag(parentModel, parentBlend, tagName);
      if (!tagTransform) return null;
      return multiplyMat4(parentModelMatrix, tagTransform.matrix);
  }

  destroy(): void {
      this.uniformBuffer.destroy();
  }
}
