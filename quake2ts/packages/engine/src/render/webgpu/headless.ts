export interface HeadlessRenderTarget {
  texture: GPUTexture;
  view: GPUTextureView;
  width: number;
  height: number;
}

export function createHeadlessRenderTarget(
  device: GPUDevice,
  width: number,
  height: number,
  format: GPUTextureFormat = 'rgba8unorm'
): HeadlessRenderTarget {
  const texture = device.createTexture({
    size: { width, height, depthOrArrayLayers: 1 },
    format,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
  });

  const view = texture.createView();

  return {
    texture,
    view,
    width,
    height
  };
}

export async function captureRenderTarget(
  device: GPUDevice,
  texture: GPUTexture
): Promise<Uint8ClampedArray> {
  const width = texture.width;
  const height = texture.height;

  // Calculate buffer size (assuming 4 bytes per pixel for rgba8unorm/bgra8unorm)
  // Rows must be padded to 256 bytes
  const bytesPerPixel = 4;
  const unpaddedBytesPerRow = width * bytesPerPixel;
  const align = 256;
  const paddedBytesPerRow = Math.max(bytesPerPixel * width, Math.ceil((width * bytesPerPixel) / align) * align);
  const bufferSize = paddedBytesPerRow * height;

  const outputBuffer = device.createBuffer({
    size: bufferSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyTextureToBuffer(
    {
      texture,
    },
    {
      buffer: outputBuffer,
      bytesPerRow: paddedBytesPerRow,
    },
    {
      width,
      height,
      depthOrArrayLayers: 1,
    }
  );

  device.queue.submit([commandEncoder.finish()]);

  await outputBuffer.mapAsync(GPUMapMode.READ);
  const mappedRange = outputBuffer.getMappedRange();

  // Create a view of the data
  // We need to remove the padding if it exists
  const data = new Uint8Array(mappedRange);
  const result = new Uint8ClampedArray(width * height * 4);

  if (paddedBytesPerRow === unpaddedBytesPerRow) {
    result.set(data);
  } else {
    for (let i = 0; i < height; i++) {
      const srcOffset = i * paddedBytesPerRow;
      const dstOffset = i * unpaddedBytesPerRow;
      result.set(data.subarray(srcOffset, srcOffset + unpaddedBytesPerRow), dstOffset);
    }
  }

  outputBuffer.unmap();

  return result;
}
