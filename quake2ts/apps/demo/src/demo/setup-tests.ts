import { vi } from 'vitest';

vi.mock('gl-matrix', () => {
    return {
        vec3: {
            create: vi.fn(() => [0, 0, 0]),
            fromValues: vi.fn((x, y, z) => [x, y, z]),
        },
        mat4: {
            create: vi.fn(() => []),
            lookAt: vi.fn(),
            perspective: vi.fn(),
        },
    }
});

vi.mock('@quake2ts/engine', async (importOriginal) => {
    const original = await importOriginal();
    return {
        ...original,
        extractFrustumPlanes: vi.fn(() => []),
    };
});
