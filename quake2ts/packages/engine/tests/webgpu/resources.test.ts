import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPUContext } from '../../src/render/webgpu/context';
import {
  VertexBuffer,
  IndexBuffer,
  Texture2D,
  ShaderModule,
  RenderPipeline,
  createRenderPassDescriptor
} from '../../src/render/webgpu/resources';
import { createHeadlessRenderTarget, captureRenderTarget } from '../../src/render/webgpu/headless';

// Import shared test utilities for WebGPU setup
import { initHeadlessWebGPU, HeadlessWebGPUSetup } from '@quake2ts/test-utils/src/setup/webgpu';

/**
 * Integration tests for WebGPU resources using real @webgpu/dawn.
 * Verifies that our resource wrappers work correctly with a real GPU driver.
 */
describe('WebGPU Resources Integration (Real)', () => {
  let gpuSetup: HeadlessWebGPUSetup;

  beforeAll(async () => {
    gpuSetup = await initHeadlessWebGPU();
  });

  afterAll(async () => {
    await gpuSetup.cleanup();
  });

  it('should create and write to a vertex buffer', async () => {

    const context = await createWebGPUContext();
    // No need to track devices manually as createWebGPUContext uses the global navigator.gpu which we shimmed

    const data = new Float32Array([1.0, 2.0, 3.0, 4.0]);
    const buffer = new VertexBuffer(context.device, {
      size: data.byteLength,
      label: 'test-vertex-buffer'
    });

    // Write data
    buffer.write(data);

    // Read back is tricky without mapping, but we can check if creation succeeded
    expect(buffer.buffer).toBeDefined();
    expect(buffer.size).toBe(16);

    // Cleanup
    buffer.destroy();
  });

  it('should create and upload a texture', async () => {
    const context = await createWebGPUContext();

    const width = 64;
    const height = 64;
    const texture = new Texture2D(context.device, {
      width,
      height,
      format: 'rgba8unorm',
      label: 'test-texture'
    });

    const data = new Uint8Array(width * height * 4);
    // Fill with red
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255;     // R
      data[i+1] = 0;     // G
      data[i+2] = 0;     // B
      data[i+3] = 255;   // A
    }

    texture.upload(data);

    expect(texture.texture).toBeDefined();
    expect(texture.width).toBe(width);
    expect(texture.height).toBe(height);

    texture.destroy();
  });

  it('should compile a shader module', async () => {
    const context = await createWebGPUContext();

    const code = `
      @vertex
      fn vs_main(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
        return vec4f(0.0, 0.0, 0.0, 1.0);
      }

      @fragment
      fn fs_main() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 0.0, 1.0);
      }
    `;

    const shader = new ShaderModule(context.device, {
      code,
      label: 'test-shader'
    });

    const info = await shader.compilationInfo;
    expect(info.messages.length).toBe(0);
  });

  it('should create a render pipeline and render a triangle', async () => {
    const context = await createWebGPUContext();

    const shader = new ShaderModule(context.device, {
      code: `
        @vertex
        fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 3>(
                vec2<f32>(0.0, 0.5),
                vec2<f32>(-0.5, -0.5),
                vec2<f32>(0.5, -0.5)
            );
            return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
        }

        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
            return vec4<f32>(1.0, 0.0, 0.0, 1.0);
        }
      `,
      label: 'triangle-shader'
    });

    const pipeline = new RenderPipeline(context.device, {
      layout: 'auto',
      vertex: {
        module: shader,
        entryPoint: 'vs_main',
        buffers: []
      },
      fragment: {
        module: shader,
        entryPoint: 'fs_main',
        targets: [{ format: 'rgba8unorm' }]
      },
      primitive: { topology: 'triangle-list' },
      label: 'triangle-pipeline'
    });

    expect(pipeline.pipeline).toBeDefined();

    // Setup render target
    const { texture, view } = createHeadlessRenderTarget(context.device, 64, 64, 'rgba8unorm');

    // Create command encoder and pass
    const commandEncoder = context.device.createCommandEncoder();
    const passDescriptor = createRenderPassDescriptor()
      .setColorAttachment(0, view, { clearValue: { r: 0, g: 0, b: 0, a: 1 } })
      .build();

    const passEncoder = commandEncoder.beginRenderPass(passDescriptor);
    passEncoder.setPipeline(pipeline.pipeline);
    passEncoder.draw(3);
    passEncoder.end();

    context.device.queue.submit([commandEncoder.finish()]);

    // Verify output (center pixel should be red)
    const pixels = await captureRenderTarget(context.device, texture);

    // Check pixel at center (32, 32)
    const index = (32 * 64 + 32) * 4;
    expect(pixels[index]).toBe(255);     // R
    expect(pixels[index+1]).toBe(0);     // G
    expect(pixels[index+2]).toBe(0);     // B
    expect(pixels[index+3]).toBe(255);   // A

    texture.destroy();
  });
});
