import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createWebGPURenderer, WebGPURenderer, WebGPURendererImpl } from '../../../src/render/webgpu/renderer.js';
import { Camera } from '../../../src/render/camera.js';
import { captureRenderTarget } from '../../../src/render/webgpu/headless.js';
import { FrameRenderOptions } from '../../../src/render/webgpu/frame.js';
import { setupHeadlessWebGPUEnv } from '@quake2ts/test-utils';
import { expectSnapshot } from '@quake2ts/test-utils';
import path from 'path';

const snapshotDir = path.join(__dirname, '__snapshots__');

describe('WebGPU Debug Rendering', () => {
    let renderer: WebGPURenderer;

    beforeAll(async () => {
        // Setup Headless WebGPU Environment
        await setupHeadlessWebGPUEnv();

        // Create renderer
        renderer = await createWebGPURenderer(undefined, { width: 320, height: 240 });
    });

    afterAll(() => {
        if (renderer) {
            renderer.destroy();
        }
    });

    it('should render debug primitives', async () => {
        const camera = new Camera(320, 240);
        camera.position = [0, -100, 50];
        camera.angles = [0, 20, 0]; // Look slightly down
        camera.updateMatrices();

        const renderOptions: FrameRenderOptions = {
            camera,
            clearColor: [0, 0, 0, 1]
        };

        // Draw debug primitives
        const debug = renderer.debug;

        // Axis lines
        debug.drawLine({ x: -20, y: 0, z: 0 }, { x: 20, y: 0, z: 0 }, { r: 1, g: 0, b: 0 });
        debug.drawLine({ x: 0, y: -20, z: 0 }, { x: 0, y: 20, z: 0 }, { r: 0, g: 1, b: 0 });
        debug.drawLine({ x: 0, y: 0, z: -20 }, { x: 0, y: 0, z: 20 }, { r: 0, g: 0, b: 1 });

        // Bounding Box
        debug.drawBoundingBox(
            { x: 30, y: -10, z: 0 },
            { x: 50, y: 10, z: 20 },
            { r: 1, g: 1, b: 0 }
        );

        // Point
        debug.drawPoint({ x: -40, y: 0, z: 10 }, 5, { r: 0, g: 1, b: 1 });

        // Cone
        debug.addCone(
            { x: 0, y: 0, z: 40 },
            { x: 0, y: 0, z: 20 },
            10,
            { r: 1, g: 0, b: 1 }
        );

        // Render Frame
        await renderer.renderFrame(renderOptions);

        // Get raw pixels
        // Need to access headlessTarget from frameRenderer
        const impl = renderer as WebGPURendererImpl;
        // @ts-ignore - accessing private property for test
        const frameRenderer = impl.frameRenderer;

        if (!frameRenderer.headlessTarget) {
            throw new Error('No headless target found on renderer');
        }

        const pixels = await captureRenderTarget(renderer.device, frameRenderer.headlessTarget);

        // Verify with snapshot
        await expectSnapshot(pixels, {
            name: 'debug-primitives',
            width: 320,
            height: 240,
            snapshotDir
        });
    });
});
