import { mat4 } from 'gl-matrix';
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
import { SPRITE_SHADER } from '../shaders/spriteShader.js';

// Max sprites per batch to pre-allocate buffers
const MAX_SPRITES = 2048;
const VERTICES_PER_SPRITE = 4;
const INDICES_PER_SPRITE = 6;
const FLOATS_PER_VERTEX = 8; // x, y, u, v, r, g, b, a

interface SpriteDrawCommand {
  texture: Texture2D | null; // null for solid color
  start: number; // Index count start
  count: number; // Index count
}

export class SpriteRenderer {
  private pipelineTextured: RenderPipeline;
  private pipelineSolid: RenderPipeline;

  private vertexBuffer: VertexBuffer;
  private indexBuffer: IndexBuffer;
  private uniformBuffer: UniformBuffer;

  private uniformBindGroup: BindGroup;
  private textureBindGroupLayout: import('../resources.js').BindGroupLayout;
  private defaultSampler: Sampler;

  private projectionMatrix: Float32Array;

  // Batching state
  private vertexData: Float32Array;
  private currentVertexCount: number = 0;
  private currentIndexCount: number = 0;
  private currentTexture: Texture2D | null = null;
  private drawCommands: SpriteDrawCommand[] = [];

  private textureBindGroups = new Map<Texture2D, BindGroup>();

  constructor(
    private device: GPUDevice,
    private format: GPUTextureFormat
  ) {
    // 1. Compile Shader
    const shaderModule = new ShaderModule(device, {
      code: SPRITE_SHADER,
      label: 'sprite-shader'
    });

    // 2. Create Layouts and Pipelines
    // Vertex Layout: position(2), texcoord(2), color(4)
    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: FLOATS_PER_VERTEX * 4,
      stepMode: 'vertex',
      attributes: [
        { format: 'float32x2', offset: 0, shaderLocation: 0 }, // position
        { format: 'float32x2', offset: 8, shaderLocation: 1 }, // texcoord
        { format: 'float32x4', offset: 16, shaderLocation: 2 } // color
      ]
    };

    // Uniform Bind Group Layout (Group 0)
    // We must use explicit layout to share bind groups between pipelines (textured vs solid).
    const bindGroupBuilder = new BindGroupBuilder('sprite-uniform-layout');
    bindGroupBuilder.addUniformBuffer(0, GPUShaderStage.VERTEX);
    const uniformBindGroupLayout = bindGroupBuilder.build(device);

    // Texture Bind Group Layout (Group 1)

    const textureBindGroupBuilder = new BindGroupBuilder('sprite-texture-layout');
    textureBindGroupBuilder.addSampler(0, GPUShaderStage.FRAGMENT);
    textureBindGroupBuilder.addTexture(1, GPUShaderStage.FRAGMENT);
    this.textureBindGroupLayout = textureBindGroupBuilder.build(device);

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [
            uniformBindGroupLayout.layout,
            this.textureBindGroupLayout.layout
        ],
        label: 'sprite-pipeline-layout'
    });

    const pipelineLayoutSolid = device.createPipelineLayout({
        bindGroupLayouts: [
            uniformBindGroupLayout.layout
        ],
        label: 'sprite-pipeline-solid-layout'
    });

    const blendState: GPUBlendState = {
      color: {
        srcFactor: 'src-alpha',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add'
      },
      alpha: {
        srcFactor: 'one',
        dstFactor: 'one-minus-src-alpha',
        operation: 'add'
      }
    };

    this.pipelineTextured = new RenderPipeline(device, {
      layout: pipelineLayout,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_main',
        targets: [{
          format: this.format,
          blend: blendState
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none' // Sprites are 2D, no culling usually needed
      },
      label: 'sprite-pipeline-textured'
    });

    this.pipelineSolid = new RenderPipeline(device, {
      layout: pipelineLayoutSolid,
      vertex: {
        module: shaderModule,
        entryPoint: 'vs_main',
        buffers: [vertexBufferLayout]
      },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs_solid',
        targets: [{
          format: this.format,
          blend: blendState
        }]
      },
      primitive: {
        topology: 'triangle-list',
        cullMode: 'none'
      },
      label: 'sprite-pipeline-solid'
    });

    // 3. Create Buffers
    this.vertexBuffer = new VertexBuffer(device, {
      size: MAX_SPRITES * VERTICES_PER_SPRITE * FLOATS_PER_VERTEX * 4,
      label: 'sprite-vertex-buffer',
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
    });

    this.indexBuffer = new IndexBuffer(device, {
      size: MAX_SPRITES * INDICES_PER_SPRITE * 2, // Uint16
      label: 'sprite-index-buffer',
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST
    });

    this.uniformBuffer = new UniformBuffer(device, {
      size: 64, // mat4
      label: 'sprite-uniform-buffer',
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });

    // 4. Create Uniform Bind Group
    this.uniformBindGroup = new BindGroup(device,
      uniformBindGroupLayout,
      [
        { binding: 0, resource: this.uniformBuffer }
      ],
      'sprite-uniform-bind-group'
    );

    // 5. Initialize Client-side Buffers
    this.vertexData = new Float32Array(MAX_SPRITES * VERTICES_PER_SPRITE * FLOATS_PER_VERTEX);

    // Pre-fill indices as they are static (0,1,2, 0,2,3 pattern)
    const indices = new Uint16Array(MAX_SPRITES * INDICES_PER_SPRITE);
    for (let i = 0; i < MAX_SPRITES; i++) {
      const v = i * 4;
      const ii = i * 6;
      indices[ii] = v;
      indices[ii + 1] = v + 1;
      indices[ii + 2] = v + 2;
      indices[ii + 3] = v;
      indices[ii + 4] = v + 2;
      indices[ii + 5] = v + 3;
    }
    this.indexBuffer.write(indices);

    this.projectionMatrix = mat4.create() as Float32Array;
    this.defaultSampler = createLinearSampler(device);
  }

  setProjection(width: number, height: number): void {
    // WebGPU uses [0,1] Z range. gl-matrix's ortho produces [-1,1] by default.
    // If we use near=-1, far=1, input Z=0 maps to NDC Z=0, which is valid in both ranges.
    mat4.ortho(this.projectionMatrix, 0, width, height, 0, -1, 1);
    this.uniformBuffer.write(this.projectionMatrix as unknown as BufferSource);
  }

  begin(commandEncoder: GPUCommandEncoder, renderTarget: GPUTextureView): void {
    // Reset batch
    this.currentVertexCount = 0;
    this.currentIndexCount = 0;
    this.drawCommands = [];
    this.currentTexture = null;

    // Store context for flush
    this._activeEncoder = commandEncoder;
    this._activeRenderTarget = renderTarget;
  }

  private _activeEncoder: GPUCommandEncoder | null = null;
  private _activeRenderTarget: GPUTextureView | null = null;

  drawTexturedQuad(x: number, y: number, w: number, h: number, texture: Texture2D,
                   u1 = 0, v1 = 0, u2 = 1, v2 = 1,
                   color: [number, number, number, number] = [1, 1, 1, 1]): void {

    if (this.currentVertexCount + VERTICES_PER_SPRITE > MAX_SPRITES * VERTICES_PER_SPRITE) {
      this.flush();
    }

    // Check texture state change
    // We need to start a new command if:
    // 1. There are no commands yet
    // 2. The texture has changed
    if (this.drawCommands.length === 0 || this.currentTexture !== texture) {
        // Close previous command logic if needed (currently minimal)

        this.drawCommands.push({
            texture: texture,
            start: this.currentIndexCount,
            count: 0
        });
        this.currentTexture = texture;
    }

    const offset = this.currentVertexCount * FLOATS_PER_VERTEX;
    const [r, g, b, a] = color;

    // TL
    this.vertexData[offset] = x;
    this.vertexData[offset + 1] = y;
    this.vertexData[offset + 2] = u1;
    this.vertexData[offset + 3] = v1;
    this.vertexData[offset + 4] = r;
    this.vertexData[offset + 5] = g;
    this.vertexData[offset + 6] = b;
    this.vertexData[offset + 7] = a;

    // BL
    this.vertexData[offset + 8] = x;
    this.vertexData[offset + 9] = y + h;
    this.vertexData[offset + 10] = u1;
    this.vertexData[offset + 11] = v2;
    this.vertexData[offset + 12] = r;
    this.vertexData[offset + 13] = g;
    this.vertexData[offset + 14] = b;
    this.vertexData[offset + 15] = a;

    // BR
    this.vertexData[offset + 16] = x + w;
    this.vertexData[offset + 17] = y + h;
    this.vertexData[offset + 18] = u2;
    this.vertexData[offset + 19] = v2;
    this.vertexData[offset + 20] = r;
    this.vertexData[offset + 21] = g;
    this.vertexData[offset + 22] = b;
    this.vertexData[offset + 23] = a;

    // TR
    this.vertexData[offset + 24] = x + w;
    this.vertexData[offset + 25] = y;
    this.vertexData[offset + 26] = u2;
    this.vertexData[offset + 27] = v1;
    this.vertexData[offset + 28] = r;
    this.vertexData[offset + 29] = g;
    this.vertexData[offset + 30] = b;
    this.vertexData[offset + 31] = a;

    this.currentVertexCount += 4;
    this.currentIndexCount += 6;

    // Update count for current command
    this.drawCommands[this.drawCommands.length - 1].count += 6;
  }

  drawSolidRect(x: number, y: number, w: number, h: number, color: [number, number, number, number]): void {
      // Use null texture for solid
      if (this.currentTexture !== null) {
          this.drawCommands.push({
              texture: null,
              start: this.currentIndexCount,
              count: 0
          });
          this.currentTexture = null;
      }

      // We can reuse drawTexturedQuad logic with 0,0 UVs (ignored by solid shader)
      this.drawTexturedQuad(x, y, w, h, null as any, 0, 0, 0, 0, color);
  }

  flush(): void {
    if (this.currentVertexCount === 0) return;
    if (!this._activeEncoder || !this._activeRenderTarget) return;

    // Upload vertices
    const usedFloats = this.currentVertexCount * FLOATS_PER_VERTEX;
    this.vertexBuffer.write(this.vertexData.subarray(0, usedFloats) as unknown as BufferSource);

    // Begin Render Pass
    const passEncoder = this._activeEncoder.beginRenderPass({
      colorAttachments: [{
        view: this._activeRenderTarget,
        loadOp: 'load',
        storeOp: 'store'
      }],
      label: 'sprite-pass'
    });

    passEncoder.setBindGroup(0, this.uniformBindGroup.bindGroup);
    passEncoder.setVertexBuffer(0, this.vertexBuffer.buffer);
    passEncoder.setIndexBuffer(this.indexBuffer.buffer, 'uint16');

    for (const cmd of this.drawCommands) {
        if (cmd.count === 0) continue;

        if (cmd.texture) {
            passEncoder.setPipeline(this.pipelineTextured.pipeline);

            // Get or create bind group for this texture
            let bindGroup = this.textureBindGroups.get(cmd.texture);
            if (!bindGroup) {
                bindGroup = new BindGroup(this.device,
                    this.textureBindGroupLayout,
                    [
                        { binding: 0, resource: this.defaultSampler },
                        { binding: 1, resource: cmd.texture.createView() }
                    ],
                    `sprite-texture-bind-group-${cmd.texture.texture.label}`
                );
                this.textureBindGroups.set(cmd.texture, bindGroup);
            }
            passEncoder.setBindGroup(1, bindGroup.bindGroup);
        } else {
            passEncoder.setPipeline(this.pipelineSolid.pipeline);
            // Solid pipeline doesn't use Group 1
        }

        passEncoder.drawIndexed(cmd.count, 1, cmd.start, 0, 0);
    }

    passEncoder.end();

    // Reset batch
    this.currentVertexCount = 0;
    this.currentIndexCount = 0;
    this.drawCommands = [];
    this.currentTexture = null;
  }

  end(): void {
    this.flush();
    this._activeEncoder = null;
    this._activeRenderTarget = null;
  }

  destroy(): void {
      this.vertexBuffer.destroy();
      this.indexBuffer.destroy();
      this.uniformBuffer.destroy();
  }
}
