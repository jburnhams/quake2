import { test as base } from 'vitest';
import {
    expectSnapshot,
    createRenderTestSetup,
    RenderTestSetup,
    captureTexture
} from '@quake2ts/test-utils';
import path from 'path';

interface VisualTestContext {
  expectSnapshot: (pixels: Uint8ClampedArray, name: string) => Promise<void>;
  renderAndExpectSnapshot: (
    fn: (
        device: GPUDevice,
        format: GPUTextureFormat,
        encoder: GPUCommandEncoder,
        view: GPUTextureView
    ) => Promise<((pass: GPURenderPassEncoder) => void) | void>,
    name: string
  ) => Promise<void>;
}

export const test = base.extend<VisualTestContext>({
  expectSnapshot: async ({ task }, use) => {
    const impl = async (pixels: Uint8ClampedArray, name: string) => {
        const updateBaseline = process.argv.includes('--update-snapshots') || process.argv.includes('-u');
        const testFile = task.file?.filepath;
        const testDir = testFile ? path.dirname(testFile) : path.join(process.cwd(), 'tests');
        const snapshotDir = path.join(testDir, '__snapshots__');

        await expectSnapshot(pixels, {
            name,
            width: 256,
            height: 256,
            updateBaseline,
            snapshotDir
        });
    };
    await use(impl);
  },

  renderAndExpectSnapshot: async ({ task }, use) => {
    const updateBaseline = process.argv.includes('--update-snapshots') || process.argv.includes('-u');
    const testFile = task.file?.filepath;
    const testDir = testFile ? path.dirname(testFile) : path.join(process.cwd(), 'tests');
    const snapshotDir = path.join(testDir, '__snapshots__');

    let setup: RenderTestSetup | undefined;

    const impl = async (
        fn: (
            device: GPUDevice,
            format: GPUTextureFormat,
            encoder: GPUCommandEncoder,
            view: GPUTextureView
        ) => Promise<((pass: GPURenderPassEncoder) => void) | void>,
        name: string
    ) => {
        setup = await createRenderTestSetup(256, 256);

        try {
            const commandEncoder = setup.context.device.createCommandEncoder();

            // Allow the test to create resources and get the render function
            // We pass all context info so the test can manage passes manually if needed
            // Fallback to 'rgba8unorm' if format is missing (quick fix)
            const renderFn = await fn(
                setup.context.device,
                setup.context.format || 'rgba8unorm',
                commandEncoder,
                setup.renderTargetView
            );

            if (typeof renderFn === 'function') {
                // Legacy mode: Wrap in a render pass
                const pass = commandEncoder.beginRenderPass({
                    colorAttachments: [{
                        view: setup.renderTargetView,
                        loadOp: 'clear',
                        clearValue: { r: 0, g: 0, b: 0, a: 0 },
                        storeOp: 'store'
                    }]
                });
                renderFn(pass);
                pass.end();
            } else {
                // Manual mode: User should have used encoder to record commands
                // We ensure it's submitted
            }

            setup.context.device.queue.submit([commandEncoder.finish()]);

            const pixels = await captureTexture(setup.context.device, setup.renderTarget, setup.width, setup.height);

            await expectSnapshot(pixels, {
                name,
                width: setup.width,
                height: setup.height,
                updateBaseline,
                snapshotDir
            });
        } finally {
            if (setup) {
                await setup.cleanup();
                setup = undefined;
            }
        }
    };

    await use(impl);

    if (setup) {
        await setup.cleanup();
    }
  },
});
