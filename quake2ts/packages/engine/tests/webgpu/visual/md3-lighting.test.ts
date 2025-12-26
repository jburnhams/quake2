import { describe } from 'vitest';
import { test } from '../../helpers/visual-testing';
import { Md3ModelMeshGPU, Md3PipelineGPU } from '../../../src/render/webgpu/pipelines/md3';
import { Md3Model } from '../../../src/assets/md3';
import { Texture2D } from '../../../src/render/webgpu/resources';
import { createMat4Identity, mat4Translate, mat4Perspective } from '@quake2ts/shared';

// Create a mock MD3 model with color attribute populated
function createColoredModel(): Md3Model {
  return {
    version: 15,
    name: 'colored.md3',
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
        triangles: [{ indices: [0, 1, 2] }],
        texCoords: [ { s: 0, t: 0 }, { s: 0, t: 1 }, { s: 1, t: 1 } ],
        vertices: [
          [
             // Use Red, Green, Blue vertex lighting colors (though structure is 12 bytes in buffer)
             // wait, buildMd3VertexData calculates lighting.
             // We need to Mock the lighting in the mock model? No, Md3PipelineGPU calls buildMd3VertexData
             // which calculates lighting based on normals and lights.
             // We want to verify that.

             // So we define normals pointing in different directions.
             { position: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 },
             { position: { x: -10, y: -10, z: 0 }, normal: { x: -1, y: 0, z: 0 }, latLng: 0 },
             { position: { x: 10, y: -10, z: 0 }, normal: { x: 1, y: 0, z: 0 }, latLng: 0 }
          ]
        ]
      }
    ]
  };
}

describe('MD3 Pipeline Lighting', () => {
    test('renders with dynamic lighting', async ({ renderAndExpectSnapshot }) => {
        const model = createColoredModel();

        await renderAndExpectSnapshot(async (device, format) => {
            const pipeline = new Md3PipelineGPU(device, format);

            // Define lighting options with a red light on the right
            const lighting = {
                ambient: [0.1, 0.1, 0.1],
                directional: {
                    direction: { x: 1, y: 0, z: 0 },
                    color: [1, 0, 0] // Red directional light from X
                }
            };

            // Note: Md3ModelMeshGPU calls buildMd3VertexData which uses these options
            const mesh = new Md3ModelMeshGPU(device, model, { frame0: 0, frame1: 0, lerp: 0 }, lighting as any);

            const texture = new Texture2D(device, { width: 1, height: 1, format: 'rgba8unorm' });
            texture.upload(new Uint8Array([255, 255, 255, 255]));

            const material = { diffuseTexture: texture };

            const fov = 90 * Math.PI / 180;
            const aspect = 1.0;
            const projection = createMat4Identity();
            mat4Perspective(projection, fov, aspect, 1, 1000);

            const modelMatrix = createMat4Identity();
            mat4Translate(modelMatrix, { x: 0, y: 0, z: -50 });

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
            name: 'md3-lighting',
            description: 'A white triangle illuminated by a red directional light from the right side, showing dynamic lighting effects.'
        });
    });
});
