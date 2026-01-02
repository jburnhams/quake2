import { TextureCubeMap } from '../resources.js';
import { WebGPUContextState } from '../context.js';
import skyboxShader from '../shaders/skybox.wgsl?raw';
import { CameraState } from '../../types/camera.js';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';
import { mat4, mat3 } from 'gl-matrix';
import { DEG2RAD } from '@quake2ts/shared';

// Full-screen quad vertices (in NDC space)
// Two triangles covering the screen with proper NDC coordinates
// This avoids the w≈0 issue with cube geometry at diagonal view angles
const FULLSCREEN_QUAD = new Float32Array([
  // Triangle 1: bottom-left, bottom-right, top-right
  -1.0, -1.0,   // vertex 0: bottom-left
   1.0, -1.0,   // vertex 1: bottom-right
   1.0,  1.0,   // vertex 2: top-right
  // Triangle 2: bottom-left, top-right, top-left
  -1.0, -1.0,   // vertex 3: bottom-left
   1.0,  1.0,   // vertex 4: top-right
  -1.0,  1.0,   // vertex 5: top-left
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

    // Create vertex buffer for full-screen quad (two triangles)
    this.vertexBuffer = device.createBuffer({
      label: 'skybox-vertex-buffer',
      size: FULLSCREEN_QUAD.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true
    });
    new Float32Array(this.vertexBuffer.getMappedRange()).set(FULLSCREEN_QUAD);
    this.vertexBuffer.unmap();

    // Create uniform buffer for full-screen approach
    // Layout (std140 aligned):
    // - inverseViewRotation: mat3 (3 vec4s = 48 bytes, rows padded to 16 bytes each)
    // - tanHalfFov: float (4 bytes)
    // - aspect: float (4 bytes)
    // - scroll: vec2 (8 bytes)
    // Total: 48 + 4 + 4 + 8 = 64 bytes
    this.uniformBuffer = device.createBuffer({
        label: 'skybox-uniform-buffer',
        size: 64,
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
          arrayStride: 8, // vec2<f32> for full-screen triangle
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: 'float32x2'
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
        depthWriteEnabled: false, // Skybox at infinite distance, don't affect depth
        depthCompare: 'always'    // Always draw skybox (rendered first as background)
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      }
    });

    this.bindGroupHelper = new SkyboxBindGroupHelper(device, bindGroupLayout, this.uniformBuffer, this.sampler);
  }

  draw(passEncoder: GPURenderPassEncoder, options: SkyboxRenderOptions): void {
    if (!options.cameraState) {
        throw new Error('SkyboxPipeline: cameraState is required for full-screen skybox rendering');
    }

    const camera = options.cameraState;

    // Build view matrix and extract the rotation part (inverse for transforming view→world)
    const view = this.matrixBuilder.buildViewMatrix(camera);

    // Extract the 3x3 rotation from view matrix and transpose it (inverse of orthonormal rotation)
    // The view matrix rotation transforms world→view, so transpose gives view→world
    const inverseViewRotation = mat3.fromValues(
        view[0], view[4], view[8],   // First column becomes first row
        view[1], view[5], view[9],   // Second column becomes second row
        view[2], view[6], view[10]   // Third column becomes third row
    );

    // Compute projection parameters
    const tanHalfFov = Math.tan((camera.fov * DEG2RAD) / 2);
    const aspect = camera.aspect;

    // Pack uniforms (std140 layout)
    // mat3 in WGSL uses vec4 padding for each column (3 columns × 16 bytes = 48 bytes)
    const uniformData = new Float32Array(16); // 64 bytes
    // Column 0 of mat3 (padded to vec4)
    uniformData[0] = inverseViewRotation[0];
    uniformData[1] = inverseViewRotation[1];
    uniformData[2] = inverseViewRotation[2];
    uniformData[3] = 0; // padding
    // Column 1 of mat3 (padded to vec4)
    uniformData[4] = inverseViewRotation[3];
    uniformData[5] = inverseViewRotation[4];
    uniformData[6] = inverseViewRotation[5];
    uniformData[7] = 0; // padding
    // Column 2 of mat3 (padded to vec4)
    uniformData[8] = inverseViewRotation[6];
    uniformData[9] = inverseViewRotation[7];
    uniformData[10] = inverseViewRotation[8];
    uniformData[11] = 0; // padding
    // Remaining uniforms
    uniformData[12] = tanHalfFov;
    uniformData[13] = aspect;
    uniformData[14] = options.scroll[0];
    uniformData[15] = options.scroll[1];

    this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

    const bindGroup = this.bindGroupHelper.getBindGroup(options.cubemap);

    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.draw(6); // Full-screen quad has 6 vertices (2 triangles)
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
