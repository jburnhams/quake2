import { test as base } from 'vitest';
import {
    expectSnapshot,
    createRenderTestSetup,
    RenderTestSetup,
    captureTexture
} from '@quake2ts/test-utils';
import path from 'path';

interface VisualTestContext {
  expectSnapshot: (pixels: Uint8ClampedArray, nameOrOptions: string | { name: string; description: string }) => Promise<void>;
  renderAndExpectSnapshot: (
    fn: (
        device: GPUDevice,
        format: GPUTextureFormat,
        encoder: GPUCommandEncoder,
        view: GPUTextureView
    ) => Promise<((pass: GPURenderPassEncoder) => void) | void>,
    nameOrOptions: string | { name: string; description: string; depth?: boolean }
  ) => Promise<void>;
}

export const test = base.extend<VisualTestContext>({
  expectSnapshot: async ({ task }, use) => {
    const impl = async (pixels: Uint8ClampedArray, nameOrOptions: string | { name: string; description: string }) => {
        const updateBaseline = process.env.UPDATE_VISUAL === '1' || process.argv.includes('--update-snapshots') || process.argv.includes('-u');
        const testFile = task.file?.filepath;
        const testDir = testFile ? path.dirname(testFile) : path.join(process.cwd(), 'tests');
        const snapshotDir = path.join(testDir, '__snapshots__');

        const name = typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions.name;
        const description = typeof nameOrOptions === 'string' ? undefined : nameOrOptions.description;

        await expectSnapshot(pixels, {
            name,
            description,
            width: 256,
            height: 256,
            updateBaseline,
            snapshotDir
        });
    };
    await use(impl);
  },

  renderAndExpectSnapshot: async ({ task }, use) => {
    const updateBaseline = process.env.UPDATE_VISUAL === '1' || process.argv.includes('--update-snapshots') || process.argv.includes('-u');
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
        nameOrOptions: string | { name: string; description: string; depth?: boolean }
    ) => {
        const name = typeof nameOrOptions === 'string' ? nameOrOptions : nameOrOptions.name;
        const description = typeof nameOrOptions === 'string' ? undefined : nameOrOptions.description;
        const depth = typeof nameOrOptions === 'string' ? false : !!nameOrOptions.depth;

        setup = await createRenderTestSetup(256, 256, { depth });
        const { device } = setup.context;

        try {
            const commandEncoder = device.createCommandEncoder();

            // Allow the test to create resources and get the render function
            // We pass all context info so the test can manage passes manually if needed
            // Fallback to 'rgba8unorm' if format is missing (quick fix)
            const renderFn = await fn(
                device,
                setup.context.format || 'rgba8unorm',
                commandEncoder,
                setup.renderTargetView
            );

            device.pushErrorScope('validation');

            if (typeof renderFn === 'function') {
                // Legacy mode: Wrap in a render pass
                const passDescriptor: GPURenderPassDescriptor = {
                    colorAttachments: [{
                        view: setup.renderTargetView,
                        loadOp: 'clear',
                        clearValue: { r: 0, g: 0, b: 0, a: 0 },
                        storeOp: 'store'
                    }]
                };

                if (setup.depthTargetView) {
                    passDescriptor.depthStencilAttachment = {
                        view: setup.depthTargetView,
                        depthClearValue: 1.0,
                        depthLoadOp: 'clear',
                        depthStoreOp: 'discard'
                    };
                }

                const pass = commandEncoder.beginRenderPass(passDescriptor);
                renderFn(pass);
                pass.end();
            } else {
                // Manual mode: User should have used encoder to record commands
                // We ensure it's submitted
            }

            device.queue.submit([commandEncoder.finish()]);

            const error = await device.popErrorScope();
            if (error) {
                throw new Error(`WebGPU validation error: ${error.message}`);
            }

            const pixels = await captureTexture(device, setup.renderTarget, setup.width, setup.height);

            await expectSnapshot(pixels, {
                name,
                description,
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
