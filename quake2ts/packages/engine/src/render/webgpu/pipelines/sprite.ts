import { Texture2D } from '../resources.js';

export interface SpriteVertex {
  position: [number, number];
  texcoord: [number, number];
  color: [number, number, number, number];
}

// Inline WGSL for now to fix build issues with importing .wgsl
// This is temporary until we have a proper build loader for wgsl
const spriteShader = `
// Vertex shader
struct VertexInput {
  @location(0) position: vec2f,
  @location(1) texcoord: vec2f,
  @location(2) color: vec4f,
}

struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) texcoord: vec2f,
  @location(1) color: vec4f,
}

struct Uniforms {
  projection: mat4x4f,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var output: VertexOutput;
  output.position = uniforms.projection * vec4f(input.position, 0.0, 1.0);
  output.texcoord = input.texcoord;
  output.color = input.color;
  return output;
}

// Fragment shader
@group(0) @binding(1) var texSampler: sampler;
@group(0) @binding(2) var tex: texture_2d<f32>;

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4f {
  let texColor = textureSample(tex, texSampler, input.texcoord);
  return texColor * input.color;
}

// Fragment shader variant for solid colors (no texture)
@fragment
fn fs_solid(input: VertexOutput) -> @location(0) vec4f {
  return input.color;
}
`;

export class SpriteRenderer {
  private device: GPUDevice;
  private pipeline: GPURenderPipeline;
  private pipelineSolid: GPURenderPipeline;
  private uniformBuffer: GPUBuffer;
  private sampler: GPUSampler;
  private vertexBuffer: GPUBuffer;
  private indexBuffer: GPUBuffer;

  private vertexData: Float32Array;
  private indexData: Uint16Array;
  private vertexCount = 0;
  private indexCount = 0;

  private currentTexture: GPUTexture | null = null;

  // Batch limits
  private readonly MAX_SPRITES = 1000;
  private readonly VERTEX_SIZE = 8; // pos(2) + uv(2) + color(4)
  private readonly FLOATS_PER_VERTEX = 8;

  private renderPass: GPURenderPassEncoder | null = null;
  private width = 0;
  private height = 0;

  constructor(device: GPUDevice, format: GPUTextureFormat) {
    this.device = device;

    // Create shader module
    const module = device.createShaderModule({
      label: 'Sprite Shader',
      code: spriteShader
    });

    // Create uniform buffer for projection
    this.uniformBuffer = device.createBuffer({
      size: 64, // mat4x4
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // Create sampler
    this.sampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
    });

    // We can't create the full bind group layout statically easily if we want to change textures
    // So we'll have a layout for uniforms+sampler, and one for texture?
    // Or just one layout and we recreate bindgroups per texture.
    // The shader expects @group(0) @binding(0) uniforms, @binding(1) sampler, @binding(2) texture

    // Let's create the BindGroupLayout
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.VERTEX,
          buffer: { type: 'uniform' }
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: {}
        },
        {
          binding: 2,
          visibility: GPUShaderStage.FRAGMENT,
          texture: {}
        }
      ]
    });

    // Create pipelines
    const pipelineLayout = device.createPipelineLayout({
      bindGroupLayouts: [bindGroupLayout]
    });

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: this.VERTEX_SIZE * 4,
      attributes: [
        { format: 'float32x2', offset: 0, shaderLocation: 0 }, // position
        { format: 'float32x2', offset: 8, shaderLocation: 1 }, // uv
        { format: 'float32x4', offset: 16, shaderLocation: 2 }, // color
      ]
    };

    this.pipeline = device.createRenderPipeline({
      label: 'Sprite Pipeline',
      layout: pipelineLayout,
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
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
              dstFactor: 'one-minus-src-alpha', // Standard alpha blending
              operation: 'add',
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });

    this.pipelineSolid = device.createRenderPipeline({
      label: 'Sprite Solid Pipeline',
      layout: pipelineLayout,
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module,
        entryPoint: 'fs_solid',
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
              dstFactor: 'one',
              operation: 'add',
            }
          }
        }]
      },
      primitive: {
        topology: 'triangle-list'
      }
    });

    // Create batch buffers
    this.vertexData = new Float32Array(this.MAX_SPRITES * 4 * this.FLOATS_PER_VERTEX);
    this.indexData = new Uint16Array(this.MAX_SPRITES * 6);

    this.vertexBuffer = device.createBuffer({
      size: this.vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.indexBuffer = device.createBuffer({
      size: this.indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });

    // Pre-calculate indices
    // 0, 1, 2, 2, 1, 3
    // But we use a loop in draw calls or pre-fill?
    // We'll fill indices dynamically or pre-fill if we always use quads.
    // Let's pre-fill indices since we always draw quads.
    for (let i = 0; i < this.MAX_SPRITES; i++) {
        const v = i * 4;
        const ii = i * 6;
        this.indexData[ii + 0] = v + 0;
        this.indexData[ii + 1] = v + 1;
        this.indexData[ii + 2] = v + 2;
        this.indexData[ii + 3] = v + 2;
        this.indexData[ii + 4] = v + 1;
        this.indexData[ii + 5] = v + 3;
    }
    // Upload indices once
    // Explicitly cast or handle the type mismatch if needed, though writeBuffer accepts ArrayBufferView
    // The error suggests that Uint16Array might be incompatible with the expected ArrayBufferView in this context due to shared buffer differences in types.
    // However, we can simply cast as any to bypass strict type check for build if needed, or better, ensure types are aligned.
    device.queue.writeBuffer(this.indexBuffer, 0, this.indexData as unknown as BufferSource);

    // We can't easily create a default bind group because we need a texture.
    // We'll handle that in flush.
  }

  setProjection(width: number, height: number) {
    this.width = width;
    this.height = height;

    // Ortho projection 0..width, 0..height, -1..1
    // WebGPU clip space is -1..1 x, -1..1 y, 0..1 z

    // 2/w, 0, 0, 0
    // 0, -2/h, 0, 0 (flip Y)
    // 0, 0, 1, 0
    // -1, 1, 0, 1

    const projection = new Float32Array([
      2.0 / width, 0, 0, 0,
      0, -2.0 / height, 0, 0,
      0, 0, 1, 0,
      -1, 1, 0, 1
    ]);

    this.device.queue.writeBuffer(this.uniformBuffer, 0, projection as unknown as BufferSource);
  }

  begin(pass: GPURenderPassEncoder) {
    this.renderPass = pass;
    this.vertexCount = 0;
    this.indexCount = 0;
    this.currentTexture = null;
  }

  drawTexturedQuad(x: number, y: number, w: number, h: number, texture: GPUTexture,
                   u0 = 0, v0 = 0, u1 = 1, v1 = 1,
                   r = 1, g = 1, b = 1, a = 1) {

    if (this.currentTexture !== texture) {
        this.flush();
        this.currentTexture = texture;
    }

    if (this.vertexCount >= this.MAX_SPRITES * 4) {
        this.flush();
    }

    // Append vertices
    const i = this.vertexCount * this.FLOATS_PER_VERTEX;

    // Top-left
    this.vertexData[i + 0] = x;
    this.vertexData[i + 1] = y;
    this.vertexData[i + 2] = u0;
    this.vertexData[i + 3] = v0;
    this.vertexData[i + 4] = r;
    this.vertexData[i + 5] = g;
    this.vertexData[i + 6] = b;
    this.vertexData[i + 7] = a;

    // Top-right
    this.vertexData[i + 8] = x + w;
    this.vertexData[i + 9] = y;
    this.vertexData[i + 10] = u1;
    this.vertexData[i + 11] = v0;
    this.vertexData[i + 12] = r;
    this.vertexData[i + 13] = g;
    this.vertexData[i + 14] = b;
    this.vertexData[i + 15] = a;

    // Bottom-left
    this.vertexData[i + 16] = x;
    this.vertexData[i + 17] = y + h;
    this.vertexData[i + 18] = u0;
    this.vertexData[i + 19] = v1;
    this.vertexData[i + 20] = r;
    this.vertexData[i + 21] = g;
    this.vertexData[i + 22] = b;
    this.vertexData[i + 23] = a;

    // Bottom-right
    this.vertexData[i + 24] = x + w;
    this.vertexData[i + 25] = y + h;
    this.vertexData[i + 26] = u1;
    this.vertexData[i + 27] = v1;
    this.vertexData[i + 28] = r;
    this.vertexData[i + 29] = g;
    this.vertexData[i + 30] = b;
    this.vertexData[i + 31] = a;

    this.vertexCount += 4;
    this.indexCount += 6;
  }

  drawSolidRect(x: number, y: number, w: number, h: number, r: number, g: number, b: number, a: number) {
      if (!this.whiteTexture) {
         this.createWhiteTexture();
      }

      this.drawTexturedQuad(x, y, w, h, this.whiteTexture!, 0, 0, 1, 1, r, g, b, a);
  }

  private whiteTexture: GPUTexture | null = null;

  private createWhiteTexture() {
      this.whiteTexture = this.device.createTexture({
          size: [1, 1],
          format: 'rgba8unorm',
          usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST
      });

      this.device.queue.writeTexture(
          { texture: this.whiteTexture },
          new Uint8Array([255, 255, 255, 255]),
          { bytesPerRow: 4 },
          { width: 1, height: 1 }
      );
  }

  flush() {
    if (this.vertexCount === 0 || !this.currentTexture || !this.renderPass) return;

    // Upload vertices
    // We only upload the used portion
    const usedFloats = this.vertexCount * this.FLOATS_PER_VERTEX;
    // writeBuffer is easy but maybe not most efficient for frequent updates.
    // Staging buffer mapping is better but more complex. writeBuffer is fine for sprites usually.
    this.device.queue.writeBuffer(
        this.vertexBuffer,
        0,
        this.vertexData as unknown as BufferSource,
        0,
        usedFloats
    );

    // Create bind group for this texture
    // TODO: Cache bind groups per texture to avoid recreation
    const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: { buffer: this.uniformBuffer } },
            { binding: 1, resource: this.sampler },
            { binding: 2, resource: this.currentTexture.createView() }
        ]
    });

    this.renderPass.setPipeline(this.pipeline);
    this.renderPass.setBindGroup(0, bindGroup);
    this.renderPass.setVertexBuffer(0, this.vertexBuffer);
    this.renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
    this.renderPass.drawIndexed(this.indexCount, 1, 0, 0, 0);

    this.vertexCount = 0;
    this.indexCount = 0;
  }

  end() {
    this.flush();
    this.renderPass = null;
  }

  destroy() {
      this.whiteTexture?.destroy();
      // buffers destroy automatically or we can call destroy
  }
}
