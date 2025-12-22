import { expect } from 'vitest';
import {
    createRenderTestSetup,
    createComputeTestSetup,
    renderAndCapture,
    runComputeAndReadback
} from './webgpu-rendering.js';

export interface GeometryBuffers {
  vertexBuffer: GPUBuffer;
  indexBuffer?: GPUBuffer;
  vertexCount: number;
  indexCount?: number;
}

/**
 * Template for testing a rendering pipeline.
 * Sets up a headless context, creates the pipeline and geometry, renders, and validates output.
 */
export async function testPipelineRendering(
  name: string,
  createPipeline: (device: GPUDevice) => GPURenderPipeline,
  setupGeometry: (device: GPUDevice) => GeometryBuffers,
  renderCallback: (pass: GPURenderPassEncoder, pipeline: GPURenderPipeline, geometry: GeometryBuffers) => void,
  expectedOutput?: Uint8ClampedArray
) {
  const setup = await createRenderTestSetup(256, 256);

  try {
    const pipeline = createPipeline(setup.context.device);
    const geometry = setupGeometry(setup.context.device);

    const pixels = await renderAndCapture(setup, (pass) => {
        pass.setPipeline(pipeline);
        renderCallback(pass, pipeline, geometry);
    });

    if (expectedOutput) {
      expect(pixels).toEqual(expectedOutput);
    } else {
      // At least verify we got pixels
      expect(pixels.length).toBe(256 * 256 * 4);
    }

    return pixels;
  } finally {
    await setup.cleanup();
  }
}

/**
 * Template for testing compute shaders.
 */
export async function testComputeShader(
  name: string,
  createComputePipeline: (device: GPUDevice) => GPUComputePipeline,
  inputData: Float32Array,
  expectedOutput?: Float32Array,
  dispatchSize: [number, number, number] = [1, 1, 1]
) {
  const setup = await createComputeTestSetup(inputData.byteLength);

  try {
      const pipeline = createComputePipeline(setup.context.device);

      // Upload input data
      // Cast inputData to any to avoid ArrayBufferLike mismatches in strict environments
      setup.context.device.queue.writeBuffer(setup.outputBuffer, 0, inputData as any);

      const bindGroup = setup.context.device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [{
              binding: 0,
              resource: { buffer: setup.outputBuffer }
          }]
      });

      const result = await runComputeAndReadback(setup, (pass) => {
          pass.setPipeline(pipeline);
          pass.setBindGroup(0, bindGroup);
          pass.dispatchWorkgroups(dispatchSize[0], dispatchSize[1], dispatchSize[2]);
      });

      if (expectedOutput) {
          const floatResult = new Float32Array(result);
          expect(floatResult).toEqual(expectedOutput);
      }

      return result;

  } finally {
    await setup.cleanup();
  }
}
