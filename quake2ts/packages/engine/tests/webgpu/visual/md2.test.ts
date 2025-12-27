import { test } from '../../helpers/visual-testing.js';
import { Md2Pipeline, Md2MeshBuffers } from '../../../src/render/webgpu/pipelines/md2Pipeline.js';
import { Md2Model } from '../../../src/assets/md2.js';
import { mat4, vec3 } from 'gl-matrix';
import { Texture2D } from '../../../src/render/webgpu/resources.js';

// Create a mock MD2 model with a simple triangle
function createMockModel(): Md2Model {
  // A simple pyramid or triangle
  // Vertex 0: (-10, -10, 0)
  // Vertex 1: (10, -10, 0)
  // Vertex 2: (0, 10, 0)
  // Frame 2 has them moved up by 10 units

  const v1 = {
      position: { x: -10, y: -10, z: 0 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v2 = {
      position: { x: 10, y: -10, z: 0 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v3 = {
      position: { x: 0, y: 10, z: 0 },
      normal: { x: 0, y: 0, z: 1 }
  };

  const v1_next = {
      position: { x: -10, y: -10, z: 10 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v2_next = {
      position: { x: 10, y: -10, z: 10 },
      normal: { x: 0, y: 0, z: 1 }
  };
  const v3_next = {
      position: { x: 0, y: 10, z: 10 },
      normal: { x: 0, y: 0, z: 1 }
  };

  const frame0 = {
      scale: { x: 1, y: 1, z: 1 },
      translate: { x: 0, y: 0, z: 0 },
      name: 'frame0',
      vertices: [v1, v2, v3]
  };

  const frame1 = {
      scale: { x: 1, y: 1, z: 1 },
      translate: { x: 0, y: 0, z: 0 },
      name: 'frame1',
      vertices: [v1_next, v2_next, v3_next]
  };

  return {
      header: {
          magic: 0, version: 8, skinWidth: 128, skinHeight: 128,
          frameSize: 0, numSkins: 0, numVertices: 3, numTexCoords: 3,
          numTriangles: 1, numGlCommands: 0, numFrames: 2,
          offsetSkins: 0, offsetTexCoords: 0, offsetTriangles: 0,
          offsetFrames: 0, offsetGlCommands: 0, offsetEnd: 0
      },
      skins: [],
      texCoords: [
          { s: 0, t: 0 },
          { s: 128, t: 0 },
          { s: 64, t: 128 }
      ],
      triangles: [
          { vertexIndices: [0, 2, 1], texCoordIndices: [0, 2, 1] }
      ],
      frames: [frame0, frame1],
      glCommands: [] // Use triangles fallback
  };
}

function createWhiteTexture(device: GPUDevice): Texture2D {
    const texture = new Texture2D(device, {
        width: 1,
        height: 1,
        format: 'rgba8unorm',
        label: 'white-texture'
    });

    texture.upload(new Uint8Array([255, 255, 255, 255]));

    return texture;
}

function createDepthTexture(device: GPUDevice, width: number, height: number): GPUTextureView {
    const texture = device.createTexture({
        size: [width, height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
        label: 'depth-texture'
    });
    return texture.createView();
}

test('md2: static render', async ({ renderAndExpectSnapshot }) => {
    const model = createMockModel();
    let mesh: Md2MeshBuffers;
    let texture: Texture2D;

    await renderAndExpectSnapshot(
        async (device, format, encoder, view) => {
            const pipeline = new Md2Pipeline(device, format);
            if (!mesh) mesh = new Md2MeshBuffers(device, model);
            if (!texture) texture = createWhiteTexture(device);

            // Update mesh for frame 0
            mesh.update(model, { frame0: 0, frame1: 0, lerp: 0 });

            // Setup camera
            const projection = mat4.create();
            mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
            const viewMatrix = mat4.create();
            mat4.lookAt(viewMatrix, [0, 0, 50], [0, 0, 0], [0, 1, 0]);

            const mvp = mat4.create();
            mat4.multiply(mvp, projection, viewMatrix);

            // Manual render pass with depth
            const depthView = createDepthTexture(device, 256, 256);
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: view,
                    loadOp: 'clear',
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: 'store'
                }],
                depthStencilAttachment: {
                    view: depthView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'discard'
                }
            });

            pipeline.bind(pass, {
                modelViewProjection: mvp,
                ambientLight: 1.0, // Fully lit
            }, texture, 0.0);

            pipeline.draw(pass, mesh);
            pass.end();
        },
        { name: 'md2-static', description: 'A simple white triangle rendered from an MD2 model' }
    );
});

test('md2: interpolated render', async ({ renderAndExpectSnapshot }) => {
    const model = createMockModel();
    let mesh: Md2MeshBuffers;
    let texture: Texture2D;

    await renderAndExpectSnapshot(
        async (device, format, encoder, view) => {
            const pipeline = new Md2Pipeline(device, format);
            if (!mesh) mesh = new Md2MeshBuffers(device, model);
            if (!texture) texture = createWhiteTexture(device);

            // Update mesh for frame 0->1
            mesh.update(model, { frame0: 0, frame1: 1, lerp: 0.5 });

            const projection = mat4.create();
            mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
            const viewMatrix = mat4.create();
            mat4.lookAt(viewMatrix, [0, -30, 20], [0, 0, 5], [0, 1, 0]); // Angled view to see depth

            const mvp = mat4.create();
            mat4.multiply(mvp, projection, viewMatrix);

            const depthView = createDepthTexture(device, 256, 256);
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: view,
                    loadOp: 'clear',
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: 'store'
                }],
                depthStencilAttachment: {
                    view: depthView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'discard'
                }
            });

            pipeline.bind(pass, {
                modelViewProjection: mvp,
                ambientLight: 1.0,
                tint: [0, 1, 0, 1]
            }, texture, 0.5);

            pipeline.draw(pass, mesh);
            pass.end();
        },
        { name: 'md2-interpolated', description: 'A green tinted triangle interpolated between two frames' }
    );
});

test('md2: dynamic light', async ({ renderAndExpectSnapshot }) => {
    const model = createMockModel();
    let mesh: Md2MeshBuffers;
    let texture: Texture2D;

    await renderAndExpectSnapshot(
        async (device, format, encoder, view) => {
            const pipeline = new Md2Pipeline(device, format);
            if (!mesh) mesh = new Md2MeshBuffers(device, model);
            if (!texture) texture = createWhiteTexture(device);

            mesh.update(model, { frame0: 0, frame1: 0, lerp: 0 });

            const projection = mat4.create();
            mat4.perspective(projection, Math.PI / 4, 1, 0.1, 100);
            const viewMatrix = mat4.create();
            mat4.lookAt(viewMatrix, [0, 0, 50], [0, 0, 0], [0, 1, 0]);

            const mvp = mat4.create();
            mat4.multiply(mvp, projection, viewMatrix);

            const dlights = [{
                origin: { x: 0, y: 0, z: 10 },
                color: { x: 1, y: 0, z: 0 },
                intensity: 50
            }];

            const depthView = createDepthTexture(device, 256, 256);
            const pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: view,
                    loadOp: 'clear',
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    storeOp: 'store'
                }],
                depthStencilAttachment: {
                    view: depthView,
                    depthClearValue: 1.0,
                    depthLoadOp: 'clear',
                    depthStoreOp: 'discard'
                }
            });

            pipeline.bind(pass, {
                modelViewProjection: mvp,
                ambientLight: 0.1,
                lightDirection: [0, 1, 0], // perpendicular to normal, so no directional light
                dlights: dlights
            }, texture, 0.0);

            pipeline.draw(pass, mesh);
            pass.end();
        },
        { name: 'md2-lit', description: 'A red lit triangle showing dynamic lighting' }
    );
});
