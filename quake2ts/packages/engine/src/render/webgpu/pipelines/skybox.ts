import { TextureCubeMap } from '../resources.js';
import { CameraState } from '../../types/camera.js';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';
import { mat4 } from 'gl-matrix';

// Standard unit cube vertices (positions only)
// 36 vertices for 12 triangles
const CUBE_VERTICES = new Float32Array([
  // Front face
  -1.0, -1.0,  1.0,
   1.0, -1.0,  1.0,
   1.0,  1.0,  1.0,
  -1.0, -1.0,  1.0,
   1.0,  1.0,  1.0,
  -1.0,  1.0,  1.0,

  // Back face
  -1.0, -1.0, -1.0,
  -1.0,  1.0, -1.0,
   1.0,  1.0, -1.0,
  -1.0, -1.0, -1.0,
   1.0,  1.0, -1.0,
   1.0, -1.0, -1.0,

  // Top face
  -1.0,  1.0, -1.0,
  -1.0,  1.0,  1.0,
   1.0,  1.0,  1.0,
  -1.0,  1.0, -1.0,
   1.0,  1.0,  1.0,
   1.0,  1.0, -1.0,

  // Bottom face
  -1.0, -1.0, -1.0,
   1.0, -1.0, -1.0,
   1.0, -1.0,  1.0,
  -1.0, -1.0, -1.0,
   1.0, -1.0,  1.0,
  -1.0, -1.0,  1.0,

  // Right face
   1.0, -1.0, -1.0,
   1.0,  1.0, -1.0,
   1.0,  1.0,  1.0,
   1.0, -1.0, -1.0,
   1.0,  1.0,  1.0,
   1.0, -1.0,  1.0,

  // Left face
  -1.0, -1.0, -1.0,
  -1.0, -1.0,  1.0,
  -1.0,  1.0,  1.0,
  -1.0, -1.0, -1.0,
  -1.0,  1.0,  1.0,
  -1.0,  1.0, -1.0,
]);

export interface SkyboxRenderOptions {
  cameraState: CameraState;      // NEW: was viewProjection matrix
  scroll: readonly [number, number];
  cubemap: TextureCubeMap;
}

// Alias for compatibility
export type SkyboxBindOptions = SkyboxRenderOptions;

import skyboxShader from '../shaders/skybox.wgsl?raw';

export class SkyboxPipeline {
  private pipeline: GPURenderPipeline;
  private vertexBuffer: GPUBuffer;
  private bindGroupHelper: SkyboxBindGroupHelper;
  private uniformBuffer: GPUBuffer;
  private sampler: GPUSampler;
  private matrixBuilder: WebGPUMatrixBuilder;

  constructor(private device: GPUDevice, private format: GPUTextureFormat) {
    this.matrixBuilder = new WebGPUMatrixBuilder();

    // Compile shader
    const module = device.createShaderModule({
      label: 'skybox-shader',
      code: skyboxShader
    });

    // Create vertex buffer for cube geometry
    this.vertexBuffer = device.createBuffer({
      label: 'skybox-vertex-buffer',
      size: CUBE_VERTICES.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(CUBE_VERTICES);
    this.vertexBuffer.unmap();

    // Create uniform buffer
    // Layout (std140 aligned):
    // - viewProjection: mat4 (64 bytes)
    // - scroll: vec2 (8 bytes)
    // Total size: 72 bytes (padded to 80 for 16-byte alignment is good practice, but 80 is fine)
    // 64 + 8 = 72. Next multiple of 16 is 80.
    this.uniformBuffer = device.createBuffer({
        label: 'skybox-uniform-buffer',
        size: 80,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create Sampler (Linear, Clamp to Edge)
    this.sampler = device.createSampler({
        label: 'skybox-sampler',
        minFilter: 'linear',
        magFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
        addressModeW: 'clamp-to-edge'
    });

    // Create Bind Group Layout
    const bindGroupLayout = device.createBindGroupLayout({
        label: 'skybox-bind-group-layout',
        entries: [
            {
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: { type: 'uniform' }
            },
            {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: { viewDimension: 'cube' }
            },
            {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: { type: 'filtering' }
            }
        ]
    });

    this.pipeline = device.createRenderPipeline({
      label: 'skybox-pipeline',
      layout: device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout]
      }),
      vertex: {
        module,
        entryPoint: 'vertexMain',
        buffers: [{
          arrayStride: 12, // vec3<f32> (3 * 4 bytes)
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3'
          }]
        }]
      },
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{
          format: this.format,
          blend: {
             // Standard alpha blending (though skybox is usually opaque)
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
        depthWriteEnabled: false, // Skybox at infinite distance
        depthCompare: 'always'    // Always draw skybox
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      }
    });

    this.bindGroupHelper = new SkyboxBindGroupHelper(device, bindGroupLayout, this.uniformBuffer, this.sampler);
  }

  draw(passEncoder: GPURenderPassEncoder, options: SkyboxRenderOptions): void {
    const camera = options.cameraState;
    if (!camera) {
       throw new Error('SkyboxPipeline: cameraState is required');
    }

    // Build matrices using native WebGPU builder
    const projection = this.matrixBuilder.buildProjectionMatrix(camera);
    const view = this.matrixBuilder.buildViewMatrix(camera);

    // Remove translation from view matrix for skybox (infinite distance)
    // View matrix is 4x4. Translation is in elements 12, 13, 14.
    const viewNoTranslation = mat4.clone(view);
    viewNoTranslation[12] = 0;
    viewNoTranslation[13] = 0;
    viewNoTranslation[14] = 0;

    const skyViewProjection = mat4.create();
    mat4.multiply(skyViewProjection, projection, viewNoTranslation);

    // Upload to uniforms
    const uniformData = new Float32Array(20); // 80 bytes / 4 = 20 floats
    uniformData.set(skyViewProjection); // 0-15
    uniformData[16] = options.scroll[0];
    uniformData[17] = options.scroll[1];
    // 18, 19 padding

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const bindGroup = this.bindGroupHelper.getBindGroup(options.cubemap);

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(36); // Cube has 36 vertices
  }

  destroy(): void {
    this.vertexBuffer.destroy();
    this.uniformBuffer.destroy();
    // pipeline and bindGroupLayouts are auto-collected
  }
}

class SkyboxBindGroupHelper {
    private bindGroupCache = new Map<TextureCubeMap, GPUBindGroup>();

    constructor(
        private device: GPUDevice,
        private layout: GPUBindGroupLayout,
        private uniformBuffer: GPUBuffer,
        private sampler: GPUSampler
    ) {}

    getBindGroup(cubemap: TextureCubeMap): GPUBindGroup {
        if (this.bindGroupCache.has(cubemap)) {
            return this.bindGroupCache.get(cubemap)!;
        }

        const bindGroup = this.device.createBindGroup({
            layout: this.layout,
            entries: [
                {
                    binding: 0,
                    resource: { buffer: this.uniformBuffer }
                },
                {
                    binding: 1,
                    resource: cubemap.createView()
                },
                {
                    binding: 2,
                    resource: this.sampler
                }
            ]
        });

        this.bindGroupCache.set(cubemap, bindGroup);
        return bindGroup;
    }
}
