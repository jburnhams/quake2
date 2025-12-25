import { expect } from 'vitest';
import {
  createRenderTestSetup,
  renderAndCapture,
  createComputeTestSetup,
  runComputeAndReadback,
  RenderTestSetup,
  ComputeTestSetup
} from './webgpu-rendering.js';

export interface GeometryBuffers {
  vertexBuffer: GPUBuffer;
  indexBuffer?: GPUBuffer;
  vertexCount: number;
  indexCount?: number;
}

/**
 * Template for testing a rendering pipeline
 */
export async function testPipelineRendering(
  name: string,
  createPipeline: (device: GPUDevice) => GPURenderPipeline,
  setupGeometry: (device: GPUDevice) => GeometryBuffers,
  expectedOutput?: Uint8ClampedArray
) {
  const setup = await createRenderTestSetup(256, 256);

  try {
    const pipeline = createPipeline(setup.context.device);
    const geometry = setupGeometry(setup.context.device);

    const pixels = await renderAndCapture(setup, (pass) => {
      pass.setPipeline(pipeline);
      pass.setVertexBuffer(0, geometry.vertexBuffer);
      if (geometry.indexBuffer) {
        pass.setIndexBuffer(geometry.indexBuffer, 'uint16'); // Assuming uint16 for simplicity
        pass.drawIndexed(geometry.indexCount || 0);
      } else {
        pass.draw(geometry.vertexCount);
      }
    });

    if (expectedOutput) {
      expect(pixels).toEqual(expectedOutput);
    } else {
      // At least verify we got pixels
      expect(pixels.length).toBe(256 * 256 * 4);
    }
  } finally {
    await setup.cleanup();
  }
}

/**
 * Template for testing compute shaders
 */
export async function testComputeShader(
  name: string,
  createComputePipeline: (device: GPUDevice) => GPUComputePipeline,
  inputData: Float32Array,
  expectedOutput?: Float32Array
) {
  const setup = await createComputeTestSetup(inputData.byteLength);
  const { device } = setup.context;

  try {
     const pipeline = createComputePipeline(device);

     // Initialize input data
     const stagingBuffer = device.createBuffer({
       size: inputData.byteLength,
       usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
       mappedAtCreation: true
     });
     new Float32Array(stagingBuffer.getMappedRange()).set(inputData);
     stagingBuffer.unmap();

     // Copy input to output buffer for processing
     const encoder = device.createCommandEncoder();
     encoder.copyBufferToBuffer(stagingBuffer, 0, setup.outputBuffer, 0, inputData.byteLength);
     device.queue.submit([encoder.finish()]);

     // Create a bind group for the storage buffer
     const bindGroup = device.createBindGroup({
         layout: pipeline.getBindGroupLayout(0),
         entries: [
             {
                 binding: 0,
                 resource: {
                     buffer: setup.outputBuffer
                 }
             }
         ]
     });

     const resultBuffer = await runComputeAndReadback(setup, (pass) => {
         pass.setPipeline(pipeline);
         pass.setBindGroup(0, bindGroup);
         pass.dispatchWorkgroups(Math.ceil(inputData.length / 64));
     });

     if (expectedOutput) {
         const floatResult = new Float32Array(resultBuffer);
         expect(floatResult).toEqual(expectedOutput);
     }

     stagingBuffer.destroy();

  } finally {
    await setup.cleanup();
  }
}
