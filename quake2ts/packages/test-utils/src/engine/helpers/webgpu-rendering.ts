import { initHeadlessWebGPU, WebGPUContextState } from '../../setup/webgpu.js';

/**
 * Interface for render test setup
 */
export interface RenderTestSetup {
  context: WebGPUContextState;
  renderTarget: GPUTexture;
  renderTargetView: GPUTextureView;
  commandEncoder: GPUCommandEncoder;
  cleanup: () => Promise<void>;
  width: number;
  height: number;
}

/**
 * Creates a setup for testing rendering pipelines.
 * Initializes a headless WebGPU context, a render target texture, and a command encoder.
 */
export async function createRenderTestSetup(
  width: number = 256,
  height: number = 256
): Promise<RenderTestSetup> {
  const setup = await initHeadlessWebGPU();
  const { device } = setup;

  // Create a render target texture
  // We use RGBA8Unorm for easy readback and standard rendering
  const renderTarget = device.createTexture({
    size: { width, height, depthOrArrayLayers: 1 },
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const renderTargetView = renderTarget.createView();

  const commandEncoder = device.createCommandEncoder();

  // We need to create a context state object compatible with our engine expectations
  const context: WebGPUContextState = {
    adapter: setup.adapter,
    device: setup.device,
    queue: setup.device.queue,
    format: 'rgba8unorm',
  };

  return {
    context,
    renderTarget,
    renderTargetView,
    commandEncoder,
    width,
    height,
    cleanup: async () => {
        renderTarget.destroy();
        await setup.cleanup();
    }
  };
}

/**
 * Captures texture content to Uint8ClampedArray (RGBA).
 * Creates its own CommandEncoder and submits immediately.
 */
export async function captureTexture(
    device: GPUDevice,
    texture: GPUTexture,
    width: number,
    height: number
): Promise<Uint8ClampedArray> {
  const commandEncoder = device.createCommandEncoder();

  // Create a buffer to read back the texture data
  // Bytes per row must be a multiple of 256 for copyTextureToBuffer
  const bytesPerPixel = 4;
  const unpaddedBytesPerRow = width * bytesPerPixel;
  const align = 256;
  const paddedBytesPerRow = Math.max(
      bytesPerPixel * width,
      Math.ceil((bytesPerPixel * width) / align) * align
  );

  const bufferSize = paddedBytesPerRow * height;

  const readbackBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Copy texture to buffer
  commandEncoder.copyTextureToBuffer(
    {
      texture: texture,
    },
    {
      buffer: readbackBuffer,
      bytesPerRow: paddedBytesPerRow,
    },
    {
      width,
      height,
      depthOrArrayLayers: 1,
    }
  );

  device.queue.submit([commandEncoder.finish()]);

  await readbackBuffer.mapAsync(GPUMapMode.READ);

  const arrayBuffer = readbackBuffer.getMappedRange();

  // Create a new buffer to hold the tightly packed data
  const output = new Uint8ClampedArray(width * height * 4);

  // Copy row by row to remove padding
  const srcBytes = new Uint8Array(arrayBuffer);
  for (let y = 0; y < height; y++) {
    const srcOffset = y * paddedBytesPerRow;
    const dstOffset = y * unpaddedBytesPerRow;
    output.set(srcBytes.subarray(srcOffset, srcOffset + unpaddedBytesPerRow), dstOffset);
  }

  readbackBuffer.unmap();
  readbackBuffer.destroy();

  return output;
}

/**
 * Helper to render and capture the output as pixel data.
 * It manages the render pass, submission, and buffer readback.
 */
export async function renderAndCapture(
  setup: RenderTestSetup,
  renderFn: (pass: GPURenderPassEncoder) => void
): Promise<Uint8ClampedArray> {
  const { device, queue } = setup.context;
  const { renderTargetView, commandEncoder, width, height } = setup;

  // Begin render pass
  const passEncoder = commandEncoder.beginRenderPass({
    colorAttachments: [
      {
        view: renderTargetView,
        clearValue: { r: 0, g: 0, b: 0, a: 0 },
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  });

  // Invoke user render function
  renderFn(passEncoder);

  // End pass
  passEncoder.end();

  // Submit the render commands
  queue.submit([commandEncoder.finish()]);

  // Capture the texture (using a new encoder)
  return captureTexture(device, setup.renderTarget, width, height);
}

/**
 * Interface for compute test setup
 */
export interface ComputeTestSetup {
  context: WebGPUContextState;
  outputBuffer: GPUBuffer;
  commandEncoder: GPUCommandEncoder;
  cleanup: () => Promise<void>;
  outputSize: number;
}

/**
 * Creates a setup for testing compute shaders.
 */
export async function createComputeTestSetup(
  outputSize: number
): Promise<ComputeTestSetup> {
  const setup = await initHeadlessWebGPU();
  const { device } = setup;

  // Create output buffer (storage and copy source)
  const outputBuffer = device.createBuffer({
    size: outputSize,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
  });

  const commandEncoder = device.createCommandEncoder();

  const context: WebGPUContextState = {
    adapter: setup.adapter,
    device: setup.device,
    queue: setup.device.queue,
    format: 'rgba8unorm',
  };

  return {
    context,
    outputBuffer,
    commandEncoder,
    outputSize,
    cleanup: async () => {
      outputBuffer.destroy();
      await setup.cleanup();
    }
  };
}

/**
 * Helper to run a compute pass and read back the output buffer.
 */
export async function runComputeAndReadback(
  setup: ComputeTestSetup,
  computeFn: (pass: GPUComputePassEncoder) => void
): Promise<ArrayBuffer> {
  const { device, queue } = setup.context;
  const { outputBuffer, commandEncoder, outputSize } = setup;

  const passEncoder = commandEncoder.beginComputePass();
  computeFn(passEncoder);
  passEncoder.end();

  // Create staging buffer for readback
  const stagingBuffer = device.createBuffer({
    size: outputSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  commandEncoder.copyBufferToBuffer(
    outputBuffer,
    0,
    stagingBuffer,
    0,
    outputSize
  );

  queue.submit([commandEncoder.finish()]);

  await stagingBuffer.mapAsync(GPUMapMode.READ);

  const mappedRange = stagingBuffer.getMappedRange();
  const result = mappedRange.slice(0); // Copy data

  stagingBuffer.unmap();
  stagingBuffer.destroy();

  return result;
}
