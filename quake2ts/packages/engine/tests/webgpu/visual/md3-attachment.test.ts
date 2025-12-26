import { describe } from 'vitest';
import { test } from '../../helpers/visual-testing';
import { Md3ModelMeshGPU, Md3PipelineGPU } from '../../../src/render/webgpu/pipelines/md3';
import { Md3Model } from '../../../src/assets/md3';
import { Texture2D } from '../../../src/render/webgpu/resources';
import { createMat4Identity, mat4Translate, mat4Perspective } from '@quake2ts/shared';

// Mock models
function createParentModel(): Md3Model {
  return {
    version: 15,
    name: 'parent.md3',
    header: {} as any,
    frames: [],
    tags: [
        // Frame 0 tags
        [
            {
                name: 'tag_weapon',
                origin: { x: 0, y: 10, z: 0 },
                axis: [
                    { x: 1, y: 0, z: 0 },
                    { x: 0, y: 1, z: 0 },
                    { x: 0, y: 0, z: 1 }
                ]
            }
        ]
    ],
    surfaces: [] // Parent invisible for this test, or we can add one
  };
}

function createAttachedModel(): Md3Model {
  return {
    version: 15,
    name: 'attached.md3',
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
             { position: { x: 0, y: 5, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 },
             { position: { x: -5, y: -5, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 },
             { position: { x: 5, y: -5, z: 0 }, normal: { x: 0, y: 0, z: 1 }, latLng: 0 }
          ]
        ]
      }
    ]
  };
}

describe('MD3 Pipeline Attachments', () => {
    test('renders attached model correctly', async ({ renderAndExpectSnapshot }) => {
        const parent = createParentModel();
        const attached = createAttachedModel();

        await renderAndExpectSnapshot(async (device, format) => {
            const pipeline = new Md3PipelineGPU(device, format);
            const parentMesh = new Md3ModelMeshGPU(device, parent, { frame0: 0, frame1: 0, lerp: 0 });
            const attachedMesh = new Md3ModelMeshGPU(device, attached, { frame0: 0, frame1: 0, lerp: 0 });

            const texture = new Texture2D(device, { width: 1, height: 1, format: 'rgba8unorm' });
            texture.upload(new Uint8Array([255, 0, 0, 255])); // Red attachment

            const material = { diffuseTexture: texture };

            const fov = 90 * Math.PI / 180;
            const aspect = 1.0;
            const projection = createMat4Identity();
            mat4Perspective(projection, fov, aspect, 1, 1000);

            const modelMatrix = createMat4Identity();
            mat4Translate(modelMatrix, { x: 0, y: 0, z: -50 });

            return (pass) => {
                 // Calculate attachment matrix
                 const attachedMatrix = pipeline.getAttachmentMatrix(
                     parent,
                     { frame0: 0, frame1: 0, lerp: 0 },
                     'tag_weapon',
                     modelMatrix
                 );

                 if (attachedMatrix) {
                     pipeline.draw(
                        pass,
                        attachedMesh.surfaces.get('surface1')!,
                        material,
                        projection as Float32Array,
                        attachedMatrix as Float32Array
                    );
                 }
            };
        }, {
            name: 'md3-attachment',
            description: 'A red triangle attached to a parent model\'s "tag_weapon", offset by 10 units in Y, viewed from a distance.'
        });
    });
});
