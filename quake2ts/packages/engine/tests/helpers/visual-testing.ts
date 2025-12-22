import { test as base } from 'vitest';
import {
    expectSnapshot,
    renderAndExpectSnapshot,
    createRenderTestSetup,
    RenderTestSetup
} from '@quake2ts/test-utils';
import path from 'path';

interface VisualTestContext {
  expectSnapshot: (pixels: Uint8ClampedArray, name: string) => Promise<void>;
  renderAndExpectSnapshot: (
    fn: (device: GPUDevice) => Promise<(pass: GPURenderPassEncoder) => void>,
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
        fn: (device: GPUDevice) => Promise<(pass: GPURenderPassEncoder) => void>,
        name: string
    ) => {
        setup = await createRenderTestSetup(256, 256);

        try {
            // Allow the test to create resources and get the render function
            const renderFn = await fn(setup.context.device);

            await renderAndExpectSnapshot(setup, renderFn, {
                name,
                updateBaseline,
                snapshotDir
            });
        } finally {
            await setup.cleanup();
            setup = undefined;
        }
    };

    await use(impl);

    if (setup) {
        await setup.cleanup();
    }
  },
});
