/**
 * Particles on WebGPU: a thin backend over the shared ParticleSystem.buildMesh, the same quads
 * the WebGL ParticleRenderer draws, so the two backends show the same particles. Alpha-blended
 * batches draw first, then additive ones; both are depth tested and write no depth, and neither
 * changes the framebuffer's alpha (as WebGL's blendFuncSeparate(..., ZERO, ONE) keeps it).
 */
import { ParticleSystem, particleViewBasis } from '../../particleSystem.js';
import { Vec3 } from '@quake2ts/shared';
import particlesShader from '../shaders/particles.wgsl?raw';
import { Texture2D, Sampler, createLinearSampler } from '../resources.js';
import { mat4 } from 'gl-matrix';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';
import { CameraState } from '../../types/camera.js';

/** Floats a vertex: position (3), uv (2), colour (4). */
const VERTEX_FLOATS = 9;

export class ParticleRenderer {
  private readonly device: GPUDevice;
  private readonly pipelineAlpha: GPURenderPipeline;
  private readonly pipelineAdditive: GPURenderPipeline;
  private readonly uniformBuffer: GPUBuffer;
  private readonly bindGroupLayout1: GPUBindGroupLayout;
  private readonly bindGroup0: GPUBindGroup;
  private readonly matrixBuilder = new WebGPUMatrixBuilder();
  private readonly tempVpMatrix: mat4 = mat4.create();

  private readonly defaultTexture: Texture2D;
  private readonly defaultSampler: Sampler;
  private readonly defaultTextureBindGroup: GPUBindGroup;
  private readonly textureBindGroups = new Map<Texture2D, GPUBindGroup>();

  private vertexBuffer: GPUBuffer | null = null;
  private indexBuffer: GPUBuffer | null = null;

  constructor(device: GPUDevice, format: GPUTextureFormat, depthStencilFormat?: GPUTextureFormat) {
    this.device = device;
    const module = device.createShaderModule({ code: particlesShader, label: 'particles' });

    const bindGroupLayout0 = device.createBindGroupLayout({
      label: 'ParticleSystem.BindGroupLayout0',
      entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'uniform' } }],
    });
    this.bindGroupLayout1 = device.createBindGroupLayout({
      label: 'ParticleSystem.BindGroupLayout1',
      entries: [
        { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
      ],
    });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout0, this.bindGroupLayout1] });

    const depthStencil: GPUDepthStencilState | undefined = depthStencilFormat
      ? { format: depthStencilFormat, depthWriteEnabled: false, depthCompare: 'less' }
      : undefined;
    const vertex: GPUVertexState = {
      module,
      entryPoint: 'vertexMain',
      buffers: [{
        arrayStride: VERTEX_FLOATS * 4,
        stepMode: 'vertex',
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x2' },
          { shaderLocation: 2, offset: 20, format: 'float32x4' },
        ],
      }],
    };
    const keepAlpha: GPUBlendComponent = { srcFactor: 'zero', dstFactor: 'one', operation: 'add' };
    const pipeline = (label: string, dstFactor: GPUBlendFactor) => device.createRenderPipeline({
      label,
      layout,
      vertex,
      fragment: {
        module,
        entryPoint: 'fragmentMain',
        targets: [{ format, blend: { color: { srcFactor: 'src-alpha', dstFactor, operation: 'add' }, alpha: keepAlpha } }],
      },
      primitive: { topology: 'triangle-list' },
      depthStencil,
    });
    this.pipelineAlpha = pipeline('ParticleSystem.Alpha', 'one-minus-src-alpha');
    this.pipelineAdditive = pipeline('ParticleSystem.Additive', 'one');

    this.uniformBuffer = device.createBuffer({
      label: 'particle-uniforms',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.bindGroup0 = device.createBindGroup({
      layout: bindGroupLayout0,
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });

    // A particle without a texture is the dot alone: a white texel under it.
    this.defaultTexture = new Texture2D(device, {
      width: 1,
      height: 1,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
      label: 'particle-white',
    });
    this.defaultTexture.upload(new Uint8Array([255, 255, 255, 255]));
    this.defaultSampler = createLinearSampler(device);
    this.defaultTextureBindGroup = this.bindGroupFor(this.defaultTexture);
  }

  private bindGroupFor(texture: Texture2D): GPUBindGroup {
    let group = this.textureBindGroups.get(texture);
    if (!group) {
      group = this.device.createBindGroup({
        layout: this.bindGroupLayout1,
        entries: [
          { binding: 0, resource: texture.createView() },
          { binding: 1, resource: this.defaultSampler.sampler },
        ],
      });
      this.textureBindGroups.set(texture, group);
    }
    return group;
  }

  private ensureBuffer(current: GPUBuffer | null, bytes: number, usage: number, label: string): GPUBuffer {
    if (current && current.size >= bytes) return current;
    current?.destroy();
    return this.device.createBuffer({ label, size: Math.max(bytes, 1024), usage: usage | GPUBufferUsage.COPY_DST });
  }

  /**
   * Draws the system's live particles. With a camera state the matrix and the quads' facing come
   * from it (as the frame renderer passes it); otherwise from the given matrix and vectors.
   * `textures` maps a particle's textureIndex to its texture; index 0 is the plain dot.
   */
  render(
    passEncoder: GPURenderPassEncoder,
    viewProjection: Float32Array,
    viewRight: Vec3,
    viewUp: Vec3,
    system: ParticleSystem,
    textures: ReadonlyMap<number, Texture2D> = new Map(),
    cameraState?: CameraState
  ): void {
    let vp = viewProjection;
    let right = viewRight;
    let up = viewUp;
    if (cameraState) {
      const view = this.matrixBuilder.buildViewMatrix(cameraState);
      const proj = this.matrixBuilder.buildProjectionMatrix(cameraState);
      mat4.multiply(this.tempVpMatrix, proj, view);
      vp = this.tempVpMatrix as Float32Array;
      ({ right, up } = particleViewBasis(cameraState.angles));
    }

    const mesh = system.buildMesh(right, up);
    if (mesh.indices.length === 0) return;

    this.vertexBuffer = this.ensureBuffer(this.vertexBuffer, mesh.vertices.byteLength, GPUBufferUsage.VERTEX, 'particle-vertices');
    // writeBuffer needs a multiple of 4 bytes; Uint16 indices may be 2 short.
    const indexBytes = Math.ceil(mesh.indices.byteLength / 4) * 4;
    this.indexBuffer = this.ensureBuffer(this.indexBuffer, indexBytes, GPUBufferUsage.INDEX, 'particle-indices');
    const indices = new Uint16Array(indexBytes / 2);
    indices.set(mesh.indices);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, new Float32Array(vp) as unknown as BufferSource);
    this.device.queue.writeBuffer(this.vertexBuffer, 0, mesh.vertices as unknown as BufferSource);
    this.device.queue.writeBuffer(this.indexBuffer, 0, indices as unknown as BufferSource);

    passEncoder.setBindGroup(0, this.bindGroup0);
    passEncoder.setVertexBuffer(0, this.vertexBuffer);
    passEncoder.setIndexBuffer(this.indexBuffer, 'uint16');
    for (const batch of mesh.batches) {
      passEncoder.setPipeline(batch.blendMode === 'additive' ? this.pipelineAdditive : this.pipelineAlpha);
      const texture = batch.textureIndex > 0 ? textures.get(batch.textureIndex) : undefined;
      passEncoder.setBindGroup(1, texture ? this.bindGroupFor(texture) : this.defaultTextureBindGroup);
      passEncoder.drawIndexed(batch.count, 1, batch.start);
    }
  }

  dispose(): void {
    this.defaultTexture.destroy();
    this.vertexBuffer?.destroy();
    this.indexBuffer?.destroy();
    this.uniformBuffer.destroy();
  }
}
