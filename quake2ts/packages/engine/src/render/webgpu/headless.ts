export interface HeadlessRenderTarget {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

/**
 * Creates a texture and view suitable for headless rendering (not presenting to canvas).
 *
 * @param device - The WebGPU device.
 * @param width - The width of the render target.
 * @param height - The height of the render target.
 * @param format - The texture format (e.g., 'rgba8unorm').
 * @returns An object containing the texture, view, and dimensions.
 */
export function createHeadlessRenderTarget(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat = 'rgba8unorm'
): HeadlessRenderTarget {
  const textureDescriptor: GPUTextureDescriptor = {
    size: { width, height, depthOrArrayLayers: 1 },
    format: format,
    // RENDER_ATTACHMENT allows rendering to it
    // COPY_SRC allows reading it back to CPU
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC | GPUTextureUsage.TEXTURE_BINDING,
  };

  const texture = device.createTexture(textureDescriptor);
  const view = texture.createView();

  return {
    texture,
    view,
    width,
    height,
  };
}

function getBytesPerPixel(format: GPUTextureFormat): number {
  switch (format) {
    case 'rgba8unorm':
    case 'bgra8unorm':
    case 'rgba8unorm-srgb':
    case 'bgra8unorm-srgb':
    case 'rgba8sint':
    case 'rgba8uint':
      return 4;
    case 'r8unorm':
    case 'r8sint':
    case 'r8uint':
      return 1;
    case 'rg8unorm':
    case 'rg8sint':
    case 'rg8uint':
      return 2;
    case 'rgba16float':
    case 'rgba16sint':
    case 'rgba16uint':
      return 8;
    case 'rgba32float':
    case 'rgba32sint':
    case 'rgba32uint':
      return 16;
    // Add more formats as needed
    default:
      throw new Error(`Unsupported texture format for readback: ${format}`);
  }
}

/**
 * Captures the content of a GPUTexture and returns it as a Uint8ClampedArray.
 * NOTE: This assumes the texture format is compatible (e.g., rgba8unorm).
 *
 * @param device - The WebGPU device.
 * @param texture - The texture to read back.
 * @returns A promise resolving to the pixel data.
 */
export async function captureRenderTarget(
  device: GPUDevice,
  texture: GPUTexture
): Promise<Uint8ClampedArray> {
  const width = texture.width;
  const height = texture.height;
  const format = texture.format;

  // Calculate buffer size
  // WebGPU requires bytesPerRow to be a multiple of 256
  const bytesPerPixel = getBytesPerPixel(format);
  const unpaddedBytesPerRow = width * bytesPerPixel;
  const align = 256;
  const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / align) * align;
  const bufferSize = paddedBytesPerRow * height;

  // Create a staging buffer for readback
  const outputBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  // Encode the copy command
  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyTextureToBuffer(
    {
      texture: texture,
    },
    {
      buffer: outputBuffer,
      bytesPerRow: paddedBytesPerRow,
    },
    {
      width: width,
      height: height,
      depthOrArrayLayers: 1,
    }
  );

  device.queue.submit([commandEncoder.finish()]);

  // Map the buffer to read it
  await outputBuffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = outputBuffer.getMappedRange();

  // Create a new buffer for the tightly packed data (removing padding)
  const result = new Uint8ClampedArray(width * height * bytesPerPixel);
  const src = new Uint8Array(arrayBuffer);

  for (let i = 0; i < height; i++) {
    const srcOffset = i * paddedBytesPerRow;
    const dstOffset = i * unpaddedBytesPerRow;
    result.set(src.subarray(srcOffset, srcOffset + unpaddedBytesPerRow), dstOffset);
  }

  outputBuffer.unmap();
  outputBuffer.destroy();

  return result;
}
