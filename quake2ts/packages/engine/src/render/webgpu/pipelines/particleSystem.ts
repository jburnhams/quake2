import { ParticleSystem, ParticleMesh } from '../../particleSystem.js';
import { Vec3 } from '@quake2ts/shared';
import particlesShader from '../shaders/particles.wgsl?raw';

export class ParticleRenderer {
  private readonly device: GPUDevice;
  private readonly pipelineAlpha: GPURenderPipeline;
  private readonly pipelineAdditive: GPURenderPipeline;
  private readonly uniformBuffer: GPUBuffer;
  private readonly bindGroup: GPUBindGroup;

  // Instance buffers
  private positionBuffer!: GPUBuffer;
  private colorBuffer!: GPUBuffer;
  private sizeBuffer!: GPUBuffer;

  private capacity = 0;

  constructor(device: GPUDevice, format: GPUTextureFormat, depthStencilFormat?: GPUTextureFormat) {
    this.device = device;

    const module = device.createShaderModule({
      code: particlesShader,
    });

    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' },
        },
      ],
    });

    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout],
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
    // mat4 (64) + vec3 (12+4pad) + vec3 (12+4pad) = ~96 bytes
    // Align to 256 for uniform buffer offset requirement if we were dynamic,
    // but just one uniform block here.
    this.uniformBuffer = device.createBuffer({
      size: 256,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        {
          binding: 0,
          resource: { buffer: this.uniformBuffer },
        },
      ],
    });

    // Initial capacity
    this.resizeBuffers(1024);
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

  prepare(system: ParticleSystem, viewRight: Vec3, viewUp: Vec3) {
    const count = system.aliveCount();
    if (count === 0) return 0;

    if (count > this.capacity) {
      this.resizeBuffers(Math.max(count, this.capacity * 2));
    }

    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 4);
    const sizes = new Float32Array(count);

    const sys = system as any;
    const maxParticles = sys.maxParticles;
    const alive = sys.alive;

    // Let's separate indices
    const alphaIndices: number[] = [];
    const additiveIndices: number[] = [];

    for (let i = 0; i < maxParticles; i++) {
        if (!alive[i]) continue;
        if (sys.blendMode[i] === 1) {
            additiveIndices.push(i);
        } else {
            alphaIndices.push(i);
        }
    }

    return { alphaIndices, additiveIndices, positions, colors, sizes, sys };
  }

  render(passEncoder: GPURenderPassEncoder, viewProjection: Float32Array, viewRight: Vec3, viewUp: Vec3, system: ParticleSystem) {
      const data = this.prepare(system, viewRight, viewUp);
      if (data === 0) return;

      const { alphaIndices, additiveIndices, positions, colors, sizes, sys } = data;

      // Update Uniforms
      const uniformData = new Float32Array(32); // 16 mat4 + 4 vec3 + 4 vec3 + padding
      uniformData.set(viewProjection, 0);
      uniformData.set([viewRight.x, viewRight.y, viewRight.z, 0], 16);
      uniformData.set([viewUp.x, viewUp.y, viewUp.z, 0], 20);

      this.device.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

      // Pack buffers
      const allIndices = [...alphaIndices, ...additiveIndices];
      let offset = 0;

      for (const i of allIndices) {
          positions[offset * 3] = sys.positionX[i];
          positions[offset * 3 + 1] = sys.positionY[i];
          positions[offset * 3 + 2] = sys.positionZ[i];

          const f = sys.fade[i] ? Math.max(sys.remaining[i] / sys.lifetime[i], 0) : 1;
          const colorScale = sys.blendMode[i] === 1 ? 1.2 : 1;

          colors[offset * 4] = sys.colorR[i] * colorScale;
          colors[offset * 4 + 1] = sys.colorG[i] * colorScale;
          colors[offset * 4 + 2] = sys.colorB[i] * colorScale;
          colors[offset * 4 + 3] = sys.colorA[i] * f;

          sizes[offset] = sys.size[i];

          offset++;
      }

      this.device.queue.writeBuffer(this.positionBuffer, 0, positions);
      this.device.queue.writeBuffer(this.colorBuffer, 0, colors);
      this.device.queue.writeBuffer(this.sizeBuffer, 0, sizes);

      // Bind common resources
      passEncoder.setBindGroup(0, this.bindGroup);

      passEncoder.setVertexBuffer(0, this.positionBuffer);
      passEncoder.setVertexBuffer(1, this.colorBuffer);
      passEncoder.setVertexBuffer(2, this.sizeBuffer);

      // Draw Alpha Blended
      if (alphaIndices.length > 0) {
           passEncoder.setPipeline(this.pipelineAlpha);
           passEncoder.draw(6, alphaIndices.length, 0, 0);
      }

      // Draw Additive Blended
      if (additiveIndices.length > 0) {
           passEncoder.setPipeline(this.pipelineAdditive);
           passEncoder.draw(6, additiveIndices.length, 0, alphaIndices.length);
      }
  }
}
