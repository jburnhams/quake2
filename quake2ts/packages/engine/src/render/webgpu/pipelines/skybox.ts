import { TextureCubeMap } from '../resources.js';
import { WebGPUContextState } from '../context.js';
import skyboxShader from '../shaders/skybox.wgsl?raw';
import { CameraState } from '../../types/camera.js';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';
import { mat4 } from 'gl-matrix';

// Skybox cube positions in Quake coordinates:
// X = Forward, Y = Left, Z = Up
// The shader transforms directions from Quake to GL cubemap coordinates for sampling.
const SKYBOX_POSITIONS = new Float32Array([
  // Front face (+X) - Quake forward direction
  1, -1, -1,
  1,  1, -1,
  1,  1,  1,
  1, -1, -1,
  1,  1,  1,
  1, -1,  1,
  // Back face (-X) - Quake backward direction
  -1,  1, -1,
  -1, -1, -1,
  -1, -1,  1,
  -1,  1, -1,
  -1, -1,  1,
  -1,  1,  1,
  // Left face (+Y) - Quake left direction
  -1, 1, -1,
  -1, 1,  1,
   1, 1,  1,
  -1, 1, -1,
   1, 1,  1,
   1, 1, -1,
  // Right face (-Y) - Quake right direction
   1, -1, -1,
   1, -1,  1,
  -1, -1,  1,
   1, -1, -1,
  -1, -1,  1,
  -1, -1, -1,
  // Top face (+Z) - Quake up direction
  -1, -1, 1,
   1, -1, 1,
   1,  1, 1,
  -1, -1, 1,
   1,  1, 1,
  -1,  1, 1,
  // Bottom face (-Z) - Quake down direction
  -1,  1, -1,
   1,  1, -1,
   1, -1, -1,
  -1,  1, -1,
   1, -1, -1,
  -1, -1, -1,
]);

export interface SkyboxRenderOptions {
  viewProjection?: Float32Array; // Legacy
  cameraState?: CameraState;     // New
  scroll: readonly [number, number];
  cubemap: TextureCubeMap;
}

// Alias for compatibility
export type SkyboxBindOptions = SkyboxRenderOptions;

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
    // 16 floats (64 bytes) + 2 floats (8 bytes) + 1 float (4 bytes) -> round up to 80 bytes for alignment or simplicty
    // Struct: mat4 (0-64), vec2 (64-72), float (72-76). Total 76 bytes. Aligned to 16 bytes -> 80 bytes.
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
        depthWriteEnabled: true,
        depthCompare: 'less-equal' // Proper depth testing ensures front faces occlude back faces
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none' // Inside the box
      }
    });

    this.bindGroupHelper = new SkyboxBindGroupHelper(device, bindGroupLayout, this.uniformBuffer, this.sampler);
  }

  draw(passEncoder: GPURenderPassEncoder, options: SkyboxRenderOptions): void {
    let viewProjection: Float32Array;
    let useNative = 0;

    if (options.cameraState) {
        // Native WebGPU path
        const view = this.matrixBuilder.buildViewMatrix(options.cameraState);
        const projection = this.matrixBuilder.buildProjectionMatrix(options.cameraState);

        // Remove translation for skybox
        view[12] = 0;
        view[13] = 0;
        view[14] = 0;

        const vp = mat4.create();
        mat4.multiply(vp, projection, view);
        viewProjection = vp as Float32Array;
        useNative = 1;
    } else if (options.viewProjection) {
        // Legacy path
        viewProjection = options.viewProjection;
        useNative = 0;
    } else {
        throw new Error('SkyboxPipeline: Either cameraState or viewProjection must be provided');
    }

    // Update uniforms
    const uniformData = new Float32Array(20); // 80 bytes
    uniformData.set(viewProjection); // 0-15
    uniformData[16] = options.scroll[0];
    uniformData[17] = options.scroll[1];
    uniformData[18] = useNative;

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
