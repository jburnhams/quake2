/// <reference types="@webgpu/types" />

export interface HeadlessRenderTarget {
  readonly texture: GPUTexture;
  readonly view: GPUTextureView;
  readonly width: number;
  readonly height: number;
  readonly format: GPUTextureFormat;
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
    height,
    format,
  };
}

export async function captureRenderTarget(
  device: GPUDevice,
  target: HeadlessRenderTarget
): Promise<Uint8ClampedArray> {
  const { texture, width, height, format } = target;

  // We need to determine the bytes per pixel based on format.
  // For now, assume rgba8unorm or bgra8unorm (4 bytes).
  // TODO: Add support/checks for other formats if needed.
  const bytesPerPixel = 4;
  const unpaddedBytesPerRow = width * bytesPerPixel;
  const align = 256;
  const paddedBytesPerRow = Math.ceil(unpaddedBytesPerRow / align) * align;
  const totalSize = paddedBytesPerRow * height;

  const buffer = device.createBuffer({
    size: totalSize,
    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
  });

  const commandEncoder = device.createCommandEncoder();
  commandEncoder.copyTextureToBuffer(
    // Explicitly pass texture as property for webgpu-native/dawn strictness?
    // The type definition says { texture: GPUTexture, ... }
    // However, Node's webgpu package might be picky about object shape or prototypes.
    { texture: texture },
    { buffer, bytesPerRow: paddedBytesPerRow, rowsPerImage: height },
    { width, height, depthOrArrayLayers: 1 }
  );

  device.queue.submit([commandEncoder.finish()]);

  await buffer.mapAsync(GPUMapMode.READ);
  const arrayBuffer = buffer.getMappedRange();

  // We need to copy row by row to remove padding and populate the result
  const output = new Uint8ClampedArray(width * height * 4);
  const src = new Uint8Array(arrayBuffer);

  for (let i = 0; i < height; i++) {
    const srcOffset = i * paddedBytesPerRow;
    const dstOffset = i * unpaddedBytesPerRow;
    output.set(src.subarray(srcOffset, srcOffset + unpaddedBytesPerRow), dstOffset);
  }

  buffer.unmap();
  buffer.destroy();

  return output;
}
