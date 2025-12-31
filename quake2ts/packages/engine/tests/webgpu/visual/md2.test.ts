import { describe, beforeAll } from 'vitest';
import { test, setupHeadlessWebGPUEnv } from '@quake2ts/test-utils'; // visual-testing';
import { Md2Pipeline, Md2MeshBuffers } from '../../../src/render/webgpu/pipelines/md2Pipeline';
import { Md2Model } from '../../../src/assets/md2';
import { Texture2D } from '../../../src/render/webgpu/resources';
import { createMat4Identity, mat4Translate, mat4Perspective } from '@quake2ts/shared';

// Helper to create a simple mock MD2 model
function createMockMd2Model(): Md2Model {
  return {
    header: {} as any, // Mock header if needed
    skins: [],
    texCoords: [
        { s: 0, t: 0 },
        { s: 0, t: 64 },
        { s: 64, t: 64 }
    ],
    triangles: [
        { vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] }
    ],
    frames: [
        {
            name: 'frame0',
            vertices: [
                { position: { x: 0, y: 10, z: 0 }, normalIndex: 0, normal: { x: 0, y: 0, z: 1 } },
                { position: { x: -10, y: -10, z: 0 }, normalIndex: 0, normal: { x: 0, y: 0, z: 1 } },
                { position: { x: 10, y: -10, z: 0 }, normalIndex: 0, normal: { x: 0, y: 0, z: 1 } }
            ],
            minBounds: { x: -10, y: -10, z: 0 },
            maxBounds: { x: 10, y: 10, z: 0 }
        }
    ],
    glCommands: [], // Correct property name
    lods: []
  };
}

describe('MD2 Pipeline', () => {
    beforeAll(async () => {
        await setupHeadlessWebGPUEnv();
    });

    test('renders a single frame md2', async ({ renderAndExpectSnapshot }) => {
        // Setup scene
        const model = createMockMd2Model();

        await renderAndExpectSnapshot(async (device, format) => {
            const pipeline = new Md2Pipeline(device, format);
            const mesh = new Md2MeshBuffers(device, model);

            // Create a 1x1 white texture
            const texture = new Texture2D(device, {
                width: 1, height: 1, format: 'rgba8unorm', label: 'white'
            });
            texture.upload(new Uint8Array([255, 255, 255, 255]));

            const material = {
                texture: texture
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
                 mesh.update(model, { frame0: 0, frame1: 0, lerp: 0 });

                 pipeline.bind(pass, {
                     modelViewProjection: projection,
                     modelMatrix: modelMatrix,
                     lightDirection: [0, 0, 1],
                     tint: [1, 1, 1, 1]
                 } as any, texture, 0);

                 pipeline.draw(pass, mesh);
            };
        }, {
            name: 'md2-single-frame',
            description: 'A single white triangle from a mock MD2 model, centered and facing the camera.',
            depth: true
        });
    });
});
