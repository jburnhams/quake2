import {
  VertexBuffer,
  IndexBuffer,
  UniformBuffer,
  BindGroup,
  BindGroupBuilder,
  RenderPipeline,
  ShaderModule,
  Texture2D,
  createLinearSampler,
  Sampler
} from '../resources.js';
import { mat4 } from 'gl-matrix';
import { WebGPUMatrixBuilder } from '../../matrix/webgpu.js';
import { Md2Model } from '../../../assets/md2.js';
import { MAX_DLIGHTS } from '../../dlight.js';
import { RenderModeConfig } from '../../frame.js';
import { Md2BindOptions, Md2FrameBlend, Md2Geometry, buildMd2Geometry } from '../../md2Pipeline.js';
import md2ShaderCode from '../shaders/md2.wgsl?raw';

export class Md2MeshBuffers {
  readonly device: GPUDevice;
  readonly geometry: Md2Geometry;
  readonly vertexBuffer: VertexBuffer;
  readonly indexBuffer: IndexBuffer;
  readonly indexCount: number;

  wireframeIndexBuffer?: IndexBuffer;
  wireframeIndexCount?: number;

  private currentFrame0: number = -1;
  private currentFrame1: number = -1;

  constructor(device: GPUDevice, model: Md2Model) {
    this.device = device;
    this.geometry = buildMd2Geometry(model);

    // We need space for 2 frames of vertex data + texcoords
    // Each vertex: pos1(3), norm1(3), pos2(3), norm2(3), uv(2) = 14 floats
    // Stride = 14 * 4 = 56 bytes
    const vertexCount = this.geometry.vertices.length;
    this.vertexBuffer = new VertexBuffer(device, {
        size: vertexCount * 56,
        label: 'md2-vertex-buffer',
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.indexBuffer = new IndexBuffer(device, {
        size: this.geometry.indices.byteLength,
        label: 'md2-index-buffer',
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });

    // Ensure index data is multiple of 4 bytes
    const indices = this.geometry.indices;
    if (indices.byteLength % 4 !== 0) {
        const paddedSize = Math.ceil(indices.byteLength / 4) * 4;
        const paddedData = new Uint8Array(paddedSize);
        paddedData.set(new Uint8Array(indices.buffer, indices.byteOffset, indices.byteLength));
        this.indexBuffer.write(paddedData);
    } else {
        this.indexBuffer.write(indices as unknown as BufferSource);
    }

    this.indexCount = this.geometry.indices.length;
  }

  update(model: Md2Model, blend: Md2FrameBlend): void {
    // Check if we need to upload new frame data
    if (this.currentFrame0 === blend.frame0 && this.currentFrame1 === blend.frame1) {
        return;
    }

    const frameA = model.frames[blend.frame0];
    const frameB = model.frames[blend.frame1];

    if (!frameA || !frameB) {
        return;
    }

    const vertexCount = this.geometry.vertices.length;
    const data = new Float32Array(vertexCount * 14);

    for (let i = 0; i < vertexCount; i++) {
        const vGeo = this.geometry.vertices[i];
        const vA = frameA.vertices[vGeo.vertexIndex];
        const vB = frameB.vertices[vGeo.vertexIndex];

        const base = i * 14;

        // Frame 1
        data[base + 0] = vA.position.x;
        data[base + 1] = vA.position.y;
        data[base + 2] = vA.position.z;
        data[base + 3] = vA.normal.x;
        data[base + 4] = vA.normal.y;
        data[base + 5] = vA.normal.z;

        // Frame 2
        data[base + 6] = vB.position.x;
        data[base + 7] = vB.position.y;
        data[base + 8] = vB.position.z;
        data[base + 9] = vB.normal.x;
        data[base + 10] = vB.normal.y;
        data[base + 11] = vB.normal.z;

        // UV (Static)
        data[base + 12] = vGeo.texCoord[0];
        data[base + 13] = vGeo.texCoord[1];
    }

    this.vertexBuffer.write(data);
    this.currentFrame0 = blend.frame0;
    this.currentFrame1 = blend.frame1;
  }

  dispose(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.wireframeIndexBuffer?.destroy();
  }
}

export class Md2Pipeline {
  private pipeline: RenderPipeline;
  private uniformBuffer: UniformBuffer; // Global uniforms
  private frameUniformBuffer: UniformBuffer; // Per-draw frame uniforms (blend)

  private frameBindGroupLayout: import('../resources.js').BindGroupLayout;

  private defaultSampler: Sampler;
  private matrixBuilder = new WebGPUMatrixBuilder();
  private meshCache = new WeakMap<Md2Model, Md2MeshBuffers>();

  constructor(private device: GPUDevice, private format: GPUTextureFormat) {
      // Shader
      const shaderModule = new ShaderModule(device, {
          code: md2ShaderCode,
          label: 'md2-shader'
      });

      // Layouts
      // Vertex:
      // 0: pos1 (vec3)
      // 1: norm1 (vec3)
      // 2: pos2 (vec3)
      // 3: norm2 (vec3)
      // 4: uv (vec2)
      const vertexBufferLayout: GPUVertexBufferLayout = {
          arrayStride: 56,
          stepMode: 'vertex',
          attributes: [
              { format: 'float32x3', offset: 0, shaderLocation: 0 }, // pos1
              { format: 'float32x3', offset: 12, shaderLocation: 1 }, // norm1
              { format: 'float32x3', offset: 24, shaderLocation: 2 }, // pos2
              { format: 'float32x3', offset: 36, shaderLocation: 3 }, // norm2
              { format: 'float32x2', offset: 48, shaderLocation: 4 }, // uv
          ]
      };

      // Group 0: Global Uniforms + Frame Uniforms + Texture + Sampler
      const bindGroupBuilder = new BindGroupBuilder('md2-bind-layout');
      bindGroupBuilder.addUniformBuffer(0, GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT); // Global
      bindGroupBuilder.addUniformBuffer(1, GPUShaderStage.VERTEX); // Frame
      bindGroupBuilder.addTexture(2, GPUShaderStage.FRAGMENT);
      bindGroupBuilder.addSampler(3, GPUShaderStage.FRAGMENT);

      const bindGroupLayout = bindGroupBuilder.build(device);

      const pipelineLayout = device.createPipelineLayout({
          bindGroupLayouts: [bindGroupLayout.layout],
          label: 'md2-pipeline-layout'
      });

      this.pipeline = new RenderPipeline(device, {
          layout: pipelineLayout,
          vertex: {
              module: shaderModule,
              entryPoint: 'vertexMain',
              buffers: [vertexBufferLayout]
          },
          fragment: {
              module: shaderModule,
              entryPoint: 'fragmentMain',
              targets: [{
                  format: this.format,
                  blend: {
                      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                      alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }
                  },
                  writeMask: GPUColorWrite.ALL
              }]
          },
          primitive: {
              topology: 'triangle-list',
              cullMode: 'back',
              frontFace: 'cw'
          },
          depthStencil: {
              depthWriteEnabled: true,
              depthCompare: 'less',
              format: 'depth24plus'
          },
          label: 'md2-pipeline'
      });

      this.uniformBuffer = new UniformBuffer(device, {
          size: 2048,
          label: 'md2-global-uniforms',
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      this.frameUniformBuffer = new UniformBuffer(device, {
          size: 16,
          label: 'md2-frame-uniforms',
          usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
      });

      this.defaultSampler = createLinearSampler(device);

      this.frameBindGroupLayout = bindGroupLayout;
  }

  getMesh(model: Md2Model): Md2MeshBuffers {
    let mesh = this.meshCache.get(model);
    if (!mesh) {
      mesh = new Md2MeshBuffers(this.device, model);
      this.meshCache.set(model, mesh);
    }
    return mesh;
  }

  bind(passEncoder: GPURenderPassEncoder, options: Md2BindOptions, texture: Texture2D, blend: number): void {
      const {
        cameraState,
        modelViewProjection,
        modelMatrix,
        lightDirection = [0, 0, 1],
        ambientLight = 0.2,
        tint = [1, 1, 1, 1],
        dlights = [],
        renderMode,
        brightness = 1.0,
        gamma = 1.0,
        fullbright = false,
        ambient = 0.0
      } = options;

      // 1. Write Global Uniforms
      const buffer = new ArrayBuffer(2048);
      const f32View = new Float32Array(buffer);
      const u32View = new Uint32Array(buffer);

      let offset = 0; // bytes

      // Calculate MVP
      const mm = modelMatrix || [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
      let finalMvp: Float32List;

      if (cameraState) {
        // Native WebGPU coordinate system path
        const view = this.matrixBuilder.buildViewMatrix(cameraState);
        const proj = this.matrixBuilder.buildProjectionMatrix(cameraState);
        const mvp = mat4.create();
        mat4.multiply(mvp, proj, view);
        mat4.multiply(mvp, mvp, mm as mat4); // Model * View * Proj
        finalMvp = mvp as Float32List;
      } else if (modelViewProjection) {
        // Fallback to pre-built matrix
        finalMvp = modelViewProjection;
      } else {
        // Neither provided - use identity
        finalMvp = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1] as Float32List;
      }

      // MVP
      for(let i=0; i<16; i++) f32View[offset/4 + i] = finalMvp[i];
      offset += 64;

      // ModelMatrix
      for(let i=0; i<16; i++) f32View[offset/4 + i] = mm[i];
      offset += 64;

      // LightDir + Ambient
      f32View[offset/4 + 0] = lightDirection[0];
      f32View[offset/4 + 1] = lightDirection[1];
      f32View[offset/4 + 2] = lightDirection[2];
      f32View[offset/4 + 3] = ambientLight;
      offset += 16;

      // Tint
      f32View[offset/4 + 0] = tint[0];
      f32View[offset/4 + 1] = tint[1];
      f32View[offset/4 + 2] = tint[2];
      f32View[offset/4 + 3] = tint[3];
      offset += 16;

      // RenderMode (u32) + 3 pads
      let modeInt = 0;
      let color = [1, 1, 1, 1];
      if (renderMode) {
          if (renderMode.mode === 'solid' || renderMode.mode === 'wireframe') modeInt = 1;
          else if (renderMode.mode === 'solid-faceted') modeInt = 2;

          if (renderMode.color) color = [...renderMode.color];
      }
      u32View[offset/4] = modeInt;
      offset += 16;

      // SolidColor (vec4)
      f32View[offset/4 + 0] = color[0];
      f32View[offset/4 + 1] = color[1];
      f32View[offset/4 + 2] = color[2];
      f32View[offset/4 + 3] = color[3];
      offset += 16;

      // Lighting controls
      const numDlights = Math.min(dlights.length, MAX_DLIGHTS);
      u32View[offset/4 + 0] = numDlights;
      f32View[offset/4 + 1] = brightness;
      f32View[offset/4 + 2] = gamma;
      f32View[offset/4 + 3] = ambient;
      offset += 16;

      // fullbright (u32) + 3 pads
      u32View[offset/4 + 0] = fullbright ? 1 : 0;
      offset += 16;

      // Dlights array
      for (let i = 0; i < MAX_DLIGHTS; i++) {
          if (i < numDlights) {
              const l = dlights[i];
              f32View[offset/4 + 0] = l.origin.x;
              f32View[offset/4 + 1] = l.origin.y;
              f32View[offset/4 + 2] = l.origin.z;
              f32View[offset/4 + 3] = 0; // pad

              f32View[offset/4 + 4] = l.color.x;
              f32View[offset/4 + 5] = l.color.y;
              f32View[offset/4 + 6] = l.color.z;
              f32View[offset/4 + 7] = l.intensity;
          }
          offset += 32;
      }

      this.uniformBuffer.write(buffer);

      // 2. Write Frame Uniforms
      const frameData = new Float32Array([blend, 0, 0, 0]); // pad to 16 bytes
      this.frameUniformBuffer.write(frameData);

      // 3. Create BindGroup
      const bg = new BindGroup(this.device, this.frameBindGroupLayout, [
          { binding: 0, resource: this.uniformBuffer },
          { binding: 1, resource: this.frameUniformBuffer },
          { binding: 2, resource: texture.createView() },
          { binding: 3, resource: this.defaultSampler }
      ], 'md2-bind-group');

      passEncoder.setPipeline(this.pipeline.pipeline);
      passEncoder.setBindGroup(0, bg.bindGroup);
  }

  draw(passEncoder: GPURenderPassEncoder, mesh: Md2MeshBuffers): void {
      passEncoder.setVertexBuffer(0, mesh.vertexBuffer.buffer);
      passEncoder.setIndexBuffer(mesh.indexBuffer.buffer, 'uint16');
      passEncoder.drawIndexed(mesh.indexCount);
  }

  dispose(): void {
    // Should be implemented to release resources.
    // However, buffers are managed by mesh cache.
    // Pipelines are managed by device.
    // This is mostly for cleanup if needed.
  }
}
