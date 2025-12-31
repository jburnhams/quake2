import { describe, beforeAll } from 'vitest';
import { test, setupHeadlessWebGPUEnv } from '@quake2ts/test-utils'; // visual-testing';
import { Md3ModelMeshGPU, Md3PipelineGPU } from '../../../src/render/webgpu/pipelines/md3';
import { Md3Model } from '../../../src/assets/md3';
import { Texture2D } from '../../../src/render/webgpu/resources';
import { createMat4Identity, mat4Translate, mat4Perspective } from '@quake2ts/shared';

// Helper to create a simple mock MD3 model
function createMockMd3Model(): Md3Model {
  return {
    version: 15,
    name: 'test.md3',
    header: {} as any,
    frames: [],
    tags: [],
    surfaces: [
      {
        magic: 0,
        name: 'surface1',
        flags: 0,
        numFrames: 1,
        numShaders: 1,
        numVerts: 3,
        numTriangles: 1,
        shaders: [{ name: 'test_shader', shaderIndex: 0 }],
        // Correcting the mock: triangles should be an array of objects with indices
        triangles: [{ indices: [0, 1, 2] }],
        texCoords: [
          { s: 0.5, t: 0 },
          { s: 0, t: 1 },
          { s: 1, t: 1 }
        ],
        vertices: [
          [
             { position: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 },
             { position: { x: -10, y: -10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 },
             { position: { x: 10, y: -10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 }
          ]
        ]
      }
    ]
  };
}

describe('MD3 Pipeline', () => {
    beforeAll(async () => {
        await setupHeadlessWebGPUEnv();
    });

    test('renders a single surface md3', async ({ renderAndExpectSnapshot }) => {
        // Setup scene
        const model = createMockMd3Model();

        await renderAndExpectSnapshot(async (device, format) => {
            const pipeline = new Md3PipelineGPU(device, format);
            const mesh = new Md3ModelMeshGPU(device, model, { frame0: 0, frame1: 0, lerp: 0 });

            // Create a 1x1 white texture
            const texture = new Texture2D(device, {
                width: 1, height: 1, format: 'rgba8unorm', label: 'white'
            });
            texture.upload(new Uint8Array([255, 255, 255, 255]));

            const material = {
                diffuseTexture: texture
            };

            // Setup matrix
            const fov = 90 * Math.PI / 180;
            const aspect = 1.0; // 256x256

            const projection = createMat4Identity();
            mat4Perspective(projection, fov, aspect, 1, 1000);

            const modelMatrix = createMat4Identity();
            mat4Translate(modelMatrix, { x: 0, y: 0, z: -50 });

            // Return render function
            return (pass) => {
                 pipeline.draw(
                    pass,
                    mesh.surfaces.get('surface1')!,
                    material,
                    projection as Float32Array,
                    modelMatrix as Float32Array
                );
            };
        }, {
            name: 'md3-single-surface',
            description: 'A single white triangle surface from a mock MD3 model, centered and facing the camera.',
            depth: true
        });
    });
});
