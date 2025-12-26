import { TextureCubeMap } from '../resources.js';
import { WebGPUContextState } from '../context.js';
import skyboxShader from '../shaders/skybox.wgsl?raw';

// Reusing positions from the original implementation
const SKYBOX_POSITIONS = new Float32Array([
  // Front
  -1, -1, 1,
  1, -1, 1,
  1, 1, 1,
  -1, -1, 1,
  1, 1, 1,
  -1, 1, 1,
  // Back
  -1, -1, -1,
  -1, 1, -1,
  1, 1, -1,
  -1, -1, -1,
  1, 1, -1,
  1, -1, -1,
  // Left
  -1, -1, -1,
  -1, -1, 1,
  -1, 1, 1,
  -1, -1, -1,
  -1, 1, 1,
  -1, 1, -1,
  // Right
  1, -1, -1,
  1, 1, -1,
  1, 1, 1,
  1, -1, -1,
  1, 1, 1,
  1, -1, 1,
  // Top
  -1, 1, -1,
  -1, 1, 1,
  1, 1, 1,
  -1, 1, -1,
  1, 1, 1,
  1, 1, -1,
  // Bottom
  -1, -1, -1,
  1, -1, -1,
  1, -1, 1,
  -1, -1, -1,
  1, -1, 1,
  -1, -1, 1,
]);

export interface SkyboxRenderOptions {
  viewProjection: Float32Array;
  scroll: readonly [number, number];
  cubemap: TextureCubeMap;
}

export class SkyboxPipeline {
  private pipeline: GPURenderPipeline;
  private vertexBuffer: GPUBuffer;
  private bindGroupHelper: SkyboxBindGroupHelper;
  private uniformBuffer: GPUBuffer;
  private sampler: GPUSampler;

  constructor(private device: GPUDevice, private format: GPUTextureFormat) {
    // Compile shader
    const module = device.createShaderModule({
      label: 'skybox-shader',
      code: skyboxShader
    });

    // Create vertex buffer
    this.vertexBuffer = device.createBuffer({
      label: 'skybox-vertex-buffer',
      size: SKYBOX_POSITIONS.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(SKYBOX_POSITIONS);
    this.vertexBuffer.unmap();

    // Create uniform buffer (mat4 + vec2 + padding)
    // 16 floats (64 bytes) + 2 floats (8 bytes) -> round up to 80 bytes for alignment or simplicty
    // Struct: mat4 (0-64), vec2 (64-72). Total 72 bytes. Aligned to 16 bytes -> 80 bytes.
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
                visibility: GPUShaderStage.VERTEX,
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
          arrayStride: 12, // vec3<f32>
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
        depthWriteEnabled: false,
        depthCompare: 'always' // Skybox is usually drawn first or last. If first, always pass.
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none' // Inside the box
      }
    });

    this.bindGroupHelper = new SkyboxBindGroupHelper(device, bindGroupLayout, this.uniformBuffer, this.sampler);
  }

  draw(passEncoder: GPURenderPassEncoder, options: SkyboxRenderOptions): void {
    // Update uniforms
    const uniformData = new Float32Array(20); // 80 bytes
    uniformData.set(options.viewProjection); // 0-15
    uniformData[16] = options.scroll[0];
    uniformData[17] = options.scroll[1];

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const bindGroup = this.bindGroupHelper.getBindGroup(options.cubemap);

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(SKYBOX_POSITIONS.length / 3);
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
