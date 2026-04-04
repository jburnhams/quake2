import { describe, it, beforeAll, afterAll } from 'vitest';
import { initHeadlessWebGPU, HeadlessWebGPUSetup } from '@quake2ts/test-utils';
import { Md2Pipeline, Md2MeshBuffers } from '../../../../src/render/webgpu/pipelines/md2Pipeline.js';
import { Md2Model } from '../../../../src/assets/md2.js';
import { Texture2D } from '../../../../src/render/webgpu/resources.js';
import { expectSnapshot, captureFramebufferAsPNG } from '@quake2ts/test-utils';
import { mat4 } from 'gl-matrix';
import path from 'path';
import { PNG } from 'pngjs';

// Helper to create a simple procedural texture
function createCheckerTexture(device: GPUDevice): Texture2D {
    const size = 64;
    const data = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const check = ((x >> 3) & 1) ^ ((y >> 3) & 1);
            const val = check ? 255 : 128;
            const i = (y * size + x) * 4;
            data[i] = val;     // R
            data[i + 1] = val; // G
            data[i + 2] = val; // B
            data[i + 3] = 255; // A
        }
    }

    const texture = new Texture2D(device, {
        width: size,
        height: size,
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        label: 'checker-texture'
    });

    device.queue.writeTexture(
        { texture: texture.texture },
        data,
        { bytesPerRow: size * 4 },
        { width: size, height: size }
    );

    return texture;
}

// Create a simple pyramid MD2 model programmatically
function createTestModel(): Md2Model {
    // 3 vertices for base, 1 for top
    const baseVerts = [
        { position: { x: -10, y: -10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
        { position: { x: 10, y: -10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
        { position: { x: 0, y: 10, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
    ];
    const topVert = { position: { x: 0, y: 0, z: 20 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 };

    // Frame 2: Scaled up
    const baseVerts2 = [
        { position: { x: -20, y: -20, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
        { position: { x: 20, y: -20, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
        { position: { x: 0, y: 20, z: 0 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 },
    ];
    const topVert2 = { position: { x: 0, y: 0, z: 30 }, normal: { x: 0, y: 0, z: 1 }, normalIndex: 0 };

    return {
        header: {
            skinWidth: 64, skinHeight: 64,
            numFrames: 2, numSkins: 1, numVertices: 4, numTriangles: 1, numTexCoords: 3,
            ident: 0, version: 8, frameSize: 0, numGlCommands: 0,
            offsetSkins: 0, offsetTexCoords: 0, offsetTriangles: 0, offsetFrames: 0, offsetGlCommands: 0, offsetEnd: 0
        },
        skins: ['test.pcx'],
        texCoords: [
            { s: 0, t: 0 }, { s: 64, t: 0 }, { s: 32, t: 64 }
        ],
        triangles: [
            { vertexIndices: [0, 1, 2], texCoordIndices: [0, 1, 2] }
        ],
        frames: [
            {
                name: 'frame1',
                scale: {x:1,y:1,z:1}, translate: {x:0,y:0,z:0},
                vertices: [...baseVerts, topVert]
            },
            {
                name: 'frame2',
                scale: {x:1,y:1,z:1}, translate: {x:0,y:0,z:0},
                vertices: [...baseVerts2, topVert2]
            }
        ],
        glCommands: [] // Use triangles
    } as Md2Model;
}

describe('MD2 Pipeline Visual Tests', () => {
    let setup: HeadlessWebGPUSetup;
    let pipeline: Md2Pipeline;
    let mesh: Md2MeshBuffers;
    let texture: Texture2D;
    let model: Md2Model;
    let renderTarget: GPUTexture;
    let depthTexture: GPUTexture;

    const width = 512;
    const height = 512;

    beforeAll(async () => {
        setup = await initHeadlessWebGPU();
        const { device } = setup;

        pipeline = new Md2Pipeline(device, 'rgba8unorm');
        model = createTestModel();
        mesh = new Md2MeshBuffers(device, model);
        texture = createCheckerTexture(device);

        renderTarget = device.createTexture({
            size: { width, height },
            format: 'rgba8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC
        });

        depthTexture = device.createTexture({
            size: { width, height },
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT
        });
    });

    afterAll(async () => {
        mesh.dispose();
        texture.texture.destroy(); // Manually destroy since Texture2D.dispose() might not exist or be public
        renderTarget.destroy();
        depthTexture.destroy();
        await setup.cleanup();
    });

    async function render(callback: (pass: GPURenderPassEncoder) => void) {
        const commandEncoder = setup.device.createCommandEncoder();
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: renderTarget.createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store'
            }
        });
        callback(pass);
        pass.end();
        setup.device.queue.submit([commandEncoder.finish()]);
    }

    it('renders static frame 1', async () => {
        const mvp = mat4.create();
        mat4.perspective(mvp, Math.PI / 4, 1, 1, 100);
        mat4.translate(mvp, mvp, [0, 0, -50]);
        mat4.rotateX(mvp, mvp, Math.PI / 4);

        await render((pass) => {
            pipeline.bind(pass, {
                modelViewProjection: mvp,
                ambientLight: 0.5,
                lightDirection: [0, 0, 1]
            }, texture, 0.0);
            mesh.update(model, { frame0: 0, frame1: 1, lerp: 0.0 });
            pipeline.draw(pass, mesh);
        });

        const pngBuffer = await captureFramebufferAsPNG(setup.device, renderTarget, { width, height });
        const png = PNG.sync.read(pngBuffer);
        await expectSnapshot(new Uint8ClampedArray(png.data), {
            name: 'md2-static',
            width,
            height,
            snapshotDir: path.join(__dirname, '__snapshots__')
        });
    });

    it('renders interpolated frame (50%)', async () => {
        const mvp = mat4.create();
        mat4.perspective(mvp, Math.PI / 4, 1, 1, 100);
        mat4.translate(mvp, mvp, [0, 0, -50]);
        mat4.rotateX(mvp, mvp, Math.PI / 4);

        await render((pass) => {
            pipeline.bind(pass, {
                modelViewProjection: mvp,
                ambientLight: 0.5,
                lightDirection: [0, 0, 1]
            }, texture, 0.5); // 50% blend
            mesh.update(model, { frame0: 0, frame1: 1, lerp: 0.5 });
            pipeline.draw(pass, mesh);
        });

        const pngBuffer = await captureFramebufferAsPNG(setup.device, renderTarget, { width, height });
        const png = PNG.sync.read(pngBuffer);
        await expectSnapshot(new Uint8ClampedArray(png.data), {
            name: 'md2-interpolated',
            width,
            height,
            snapshotDir: path.join(__dirname, '__snapshots__')
        });
    });

    it('renders with dynamic light', async () => {
        const mvp = mat4.create();
        mat4.perspective(mvp, Math.PI / 4, 1, 1, 100);
        mat4.translate(mvp, mvp, [0, 0, -50]);
        mat4.rotateX(mvp, mvp, Math.PI / 4);

        await render((pass) => {
            pipeline.bind(pass, {
                modelViewProjection: mvp,
                ambientLight: 0.1,
                lightDirection: [0, 0, 1],
                dlights: [{
                    origin: { x: 0, y: 0, z: 10 },
                    color: { x: 1, y: 0, z: 0 },
                    intensity: 50
                }]
            }, texture, 0.0);
            mesh.update(model, { frame0: 0, frame1: 1, lerp: 0.0 });
            pipeline.draw(pass, mesh);
        });

        const pngBuffer = await captureFramebufferAsPNG(setup.device, renderTarget, { width, height });
        const png = PNG.sync.read(pngBuffer);
        await expectSnapshot(new Uint8ClampedArray(png.data), {
            name: 'md2-lit',
            width,
            height,
            snapshotDir: path.join(__dirname, '__snapshots__')
        });
    });
});
