import { ParticleSystem, ParticleMesh } from '../../particleSystem.js';
import { Vec3, angleVectors } from '@quake2ts/shared';
import particlesShader from '../shaders/particles.wgsl?raw';
import { Texture2D, Sampler, createLinearSampler } from '../resources.js';
import { CameraState } from '../../types/camera.js';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';
import { mat4, vec3 } from 'gl-matrix';

interface ParticleBatch {
  textureIndex: number;
  blendMode: number; // 0 = alpha, 1 = additive
  start: number;
  count: number;
}

export class ParticleRenderer {
  private readonly device: GPUDevice;
  private readonly pipelineAlpha: GPURenderPipeline;
  private readonly pipelineAdditive: GPURenderPipeline;
  private readonly uniformBuffer: GPUBuffer;
  private readonly bindGroupLayout0: GPUBindGroupLayout;
  private readonly bindGroupLayout1: GPUBindGroupLayout; // Texture group
  private readonly bindGroup0: GPUBindGroup;

  // Default resources
  private readonly defaultTexture: Texture2D;
  private readonly defaultSampler: Sampler;
  private readonly defaultTextureBindGroup: GPUBindGroup;

  // Instance buffers
  private positionBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;
  private sizeBuffer!: GPUBuffer;

  private capacity = 0;

  // Cache for dynamic bind groups
  private textureBindGroups = new Map<number, GPUBindGroup>();
  private matrixBuilder = new WebGPUMatrixBuilder();

  constructor(device: GPUDevice, format: GPUTextureFormat, depthStencilFormat?: GPUTextureFormat) {
    this.device = device;

    const module = device.createShaderModule({
      code: particlesShader,
    });

    // Group 0: Uniforms
    this.bindGroupLayout0 = device.createBindGroupLayout({
      label: 'ParticleSystem.BindGroupLayout0',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    });

    // Group 1: Texture & Sampler
    this.bindGroupLayout1 = device.createBindGroupLayout({
      label: 'ParticleSystem.BindGroupLayout1',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float', viewDimension: '2d' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [this.bindGroupLayout0, this.bindGroupLayout1],
    });

    // Create depth stencil configuration only if a format is provided
    const depthStencil: GPUDepthStencilState | undefined = depthStencilFormat ? {
        format: depthStencilFormat,
        depthWriteEnabled: false,
        depthCompare: 'less',
    } : undefined;

    const vertexState: GPUVertexState = {
        module,
        entryPoint: 'vertexMain',
        buffers: [
          // Instance attributes
          {
            arrayStride: 12, // vec3<f32> position
            stepMode: 'instance',
            attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }],
          },
          {
            arrayStride: 16, // vec4<f32> color
            stepMode: 'instance',
            attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x4' }],
          },
          {
            arrayStride: 4, // f32 size
            stepMode: 'instance',
            attributes: [{ shaderLocation: 3, offset: 0, format: 'float32' }],
          }
        ],
    };

    const primitiveState: GPUPrimitiveState = {
        topology: 'triangle-list',
    };

    // Alpha Blending Pipeline
    this.pipelineAlpha = device.createRenderPipeline({
      label: 'ParticleSystem.Alpha',
      layout: pipelineLayout,
      vertex: vertexState,
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [
          {
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
          },
        ],
      },
      primitive: primitiveState,
      depthStencil,
    });

    // Additive Blending Pipeline
    this.pipelineAdditive = device.createRenderPipeline({
      label: 'ParticleSystem.Additive',
      layout: pipelineLayout,
      vertex: vertexState,
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [
          {
            format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one', // Additive
                operation: 'add',
              },
              alpha: {
                srcFactor: 'src-alpha',
                dstFactor: 'one',
                operation: 'add',
              },
            },
          },
        ],
      },
      primitive: primitiveState,
      depthStencil,
    });

    // Uniform buffer (ViewProj matrix + Right + Up)
    this.uniformBuffer = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup0 = device.createBindGroup({
      layout: this.bindGroupLayout0,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    // Initialize Default Texture (Soft Circle)
    this.defaultTexture = this.createDefaultTexture();
    this.defaultSampler = createLinearSampler(device);
    this.defaultTextureBindGroup = this.createBindGroupForTexture(this.defaultTexture);

    // Initial capacity
    this.resizeBuffers(1024);
  }

  private createDefaultTexture(): Texture2D {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Normalized coordinates -1 to 1
        const u = (x / (size - 1)) * 2 - 1;
        const v = (y / (size - 1)) * 2 - 1;
        const dist = Math.sqrt(u * u + v * v);

        // Soft circle logic:
        // We want 1.0 at center, fading out to 0 around 0.7-1.0
        // Matching shader: 1.0 - smoothstep(0.35, 0.5, dist) where dist is 0..0.5 from center
        // In our texture coord system (-1 to 1), radius 1 corresponds to dist 0.5 in shader UV (0..1)
        // So dist in texture = 2 * dist in shader
        // Shader logic: smoothstep(0.35, 0.5, shaderDist)
        // Texture logic: smoothstep(0.7, 1.0, texDist)

        let alpha = 0;
        if (dist < 0.7) {
             alpha = 1;
        } else if (dist <= 1.0) {
             // Smoothstep
             const t = (dist - 0.7) / 0.3;
             alpha = 1.0 - (t * t * (3 - 2 * t));
        }

        const i = (y * size + x) * 4;
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
        data[i + 3] = Math.floor(alpha * 255);
      }
    }

    const texture = new Texture2D(this.device, {
        width: size,
        height: size,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
    });
    texture.upload(data);
    return texture;
  }

  private createBindGroupForTexture(texture: Texture2D): GPUBindGroup {
      return this.device.createBindGroup({
          layout: this.bindGroupLayout1,
          entries: [
              { binding: 0, resource: texture.createView() },
              { binding: 1, resource: this.defaultSampler.sampler }
          ]
      });
  }

  private resizeBuffers(count: number) {
    if (this.positionBuffer) this.positionBuffer.destroy();
    if (this.colorBuffer) this.colorBuffer.destroy();
    if (this.sizeBuffer) this.sizeBuffer.destroy();

    this.capacity = count;

    this.positionBuffer = this.device.createBuffer({
      size: count * 12, // vec3
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.colorBuffer = this.device.createBuffer({
      size: count * 16, // vec4
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.sizeBuffer = this.device.createBuffer({
      size: count * 4, // f32
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
  }

  prepare(system: ParticleSystem): {
      batches: ParticleBatch[],
      positions: Float32Array,
      colors: Float32Array,
      sizes: Float32Array,
      sys: any
  } | null {
    const count = system.aliveCount();
    if (count === 0) return null;

    if (count > this.capacity) {
      this.resizeBuffers(Math.max(count, this.capacity * 2));
    }

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);
    const sizes = new Float32Array(count);

    const sys = system as any;
    const maxParticles = sys.maxParticles;
    const alive = sys.alive;

    // 1. Collect all valid indices
    const indices: number[] = [];
    for (let i = 0; i < maxParticles; i++) {
        if (alive[i]) indices.push(i);
    }

    // 2. Sort indices by textureIndex then blendMode
    indices.sort((a, b) => {
        const texDiff = sys.textureIndex[a] - sys.textureIndex[b];
        if (texDiff !== 0) return texDiff;
        return sys.blendMode[a] - sys.blendMode[b];
    });

    // 3. Generate batches and fill buffers
    const batches: ParticleBatch[] = [];
    let currentBatch: ParticleBatch | null = null;
    let offset = 0;

    for (const i of indices) {
        const textureIndex = sys.textureIndex[i];
        const blendMode = sys.blendMode[i]; // 0 or 1

        // Check if we need to start a new batch
        if (!currentBatch || currentBatch.textureIndex !== textureIndex || currentBatch.blendMode !== blendMode) {
            currentBatch = {
                textureIndex,
                blendMode,
                start: offset,
                count: 0
            };
            batches.push(currentBatch);
        }

        currentBatch.count++;

        // Fill buffers
        positions[offset * 3] = sys.positionX[i];
        positions[offset * 3 + 1] = sys.positionY[i];
        positions[offset * 3 + 2] = sys.positionZ[i];

        const f = sys.fade[i] ? Math.max(sys.remaining[i] / sys.lifetime[i], 0) : 1;
        const colorScale = blendMode === 1 ? 1.2 : 1;

        colors[offset * 4] = sys.colorR[i] * colorScale;
        colors[offset * 4 + 1] = sys.colorG[i] * colorScale;
        colors[offset * 4 + 2] = sys.colorB[i] * colorScale;
        colors[offset * 4 + 3] = sys.colorA[i] * f;

        sizes[offset] = sys.size[i];

        offset++;
    }

    return { batches, positions, colors, sizes, sys };
  }

  render(passEncoder: GPURenderPassEncoder,
         cameraState: CameraState | null,
         viewProjection: Float32Array,
         viewRight: Vec3,
         viewUp: Vec3,
         system: ParticleSystem,
         textures: Map<number, Texture2D> = new Map()) {
      const data = this.prepare(system);
      if (!data) return;

      const { batches, positions, colors, sizes } = data;

      let finalViewProjection = viewProjection;
      let finalViewRight = viewRight;
      let finalViewUp = viewUp;

      if (cameraState) {
        const view = this.matrixBuilder.buildViewMatrix(cameraState);
        const proj = this.matrixBuilder.buildProjectionMatrix(cameraState);
        const vp = mat4.create();
        mat4.multiply(vp, proj, view);
        finalViewProjection = vp as Float32Array;

        // Extract Right and Up vectors in Quake space from camera angles
        // Quake: +X Forward, +Y Left, +Z Up
        // We want Billboard vectors (Right and Up) for the particles.
        // The particles are in Quake Space.
        // To face the camera, we need the Camera's Right and Up vectors in Quake Space.
        // angleVectors(angles, forward, right, up)

        const angles = { x: cameraState.angles[0], y: cameraState.angles[1], z: cameraState.angles[2] };
        const result = angleVectors(angles);

        finalViewRight = result.right;
        finalViewUp = result.up;
      }

      // Update Uniforms
      const uniformData = new Float32Array(32);
      uniformData.set(finalViewProjection, 0);
      uniformData.set([finalViewRight.x, finalViewRight.y, finalViewRight.z, 0], 16);
      uniformData.set([finalViewUp.x, finalViewUp.y, finalViewUp.z, 0], 20);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData as unknown as BufferSource);

      // Upload Buffers
      this.device.queue.writeBuffer(this.positionBuffer, 0, positions as unknown as BufferSource);
      this.device.queue.writeBuffer(this.colorBuffer, 0, colors as unknown as BufferSource);
      this.device.queue.writeBuffer(this.sizeBuffer, 0, sizes as unknown as BufferSource);

      // Bind common resources
      passEncoder.setBindGroup(0, this.bindGroup0);

      passEncoder.setVertexBuffer(0, this.positionBuffer);
      passEncoder.setVertexBuffer(1, this.colorBuffer);
      passEncoder.setVertexBuffer(2, this.sizeBuffer);

      // Draw Batches
      for (const batch of batches) {
          // Set Pipeline
          passEncoder.setPipeline(batch.blendMode === 1 ? this.pipelineAdditive : this.pipelineAlpha);

          // Resolve Texture
          let textureBindGroup = this.defaultTextureBindGroup;
          if (batch.textureIndex > 0) { // 0 is default
               const texture = textures.get(batch.textureIndex);
               if (texture) {
                   let group = this.textureBindGroups.get(batch.textureIndex);
                   if (!group) {
                       // Cache/Create bind group for this texture index
                       // Note: This assumes textures in map don't change for the same index
                       group = this.createBindGroupForTexture(texture);
                       this.textureBindGroups.set(batch.textureIndex, group);
                   }
                   textureBindGroup = group;
               }
          }

          passEncoder.setBindGroup(1, textureBindGroup);
          passEncoder.draw(6, batch.count, 0, batch.start);
      }
  }

  dispose() {
      this.defaultTexture.destroy();
      this.positionBuffer?.destroy();
      this.colorBuffer?.destroy();
      this.sizeBuffer?.destroy();
      this.uniformBuffer.destroy();
  }
}
