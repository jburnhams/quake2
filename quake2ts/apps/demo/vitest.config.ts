import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        environment: 'node',
        setupFiles: ['./src/demo/setup-tests.ts'],
    },
    resolve: {
        alias: {
            '@quake2ts/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
            '@quake2ts/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
        },
    },
});
