
import { describe, it, expect, vi } from 'vitest';
import { buildRenderableEntities } from '../../src/entities.js';
import { EntityState, ConfigStringIndex } from '@quake2ts/shared';
import { ClientImports } from '../../src/index.js';
import {
    createMockAssetManager,
    createMockMd2Model,
    MockClientConfigStrings,
    createMockRenderer,
    createMockEngineImports,
    createEntityStateFactory
} from '@quake2ts/test-utils';

describe('buildRenderableEntities', () => {
    // Mock ConfigStrings using test-utils helper
    const mockConfigStrings = new MockClientConfigStrings();

    // Mock AssetManager using centralized factory from test-utils
    const mockAssets = createMockAssetManager();

    // Mock ClientImports using centralized factory
    const mockImports = {
        engine: createMockEngineImports({
            assets: mockAssets,
            renderer: createMockRenderer()
        })
    } as unknown as ClientImports;

    // Mock MD2 Model using centralized factory from test-utils
    // IDP2 magic number = 844121161 for MD2 format (ref: ref_gl/r_model.c)
    const mockMd2Model = createMockMd2Model({
        header: { magic: 844121161 } as any
    });

    it('should interpolate scale correctly', () => {
        // Setup mocks
        mockConfigStrings.set(ConfigStringIndex.Models + 1, 'models/test.md2');
        (mockAssets.getMd2Model as any).mockReturnValue(mockMd2Model);

        const stateA = createEntityStateFactory({
            number: 1,
            modelIndex: 1,
            scale: 1.0,
            alpha: 255
        });

        const stateB = createEntityStateFactory({
            ...stateA,
            scale: 2.0
        });

        const renderables = buildRenderableEntities([stateB], [stateA], 0.5, mockConfigStrings, mockImports);

        expect(renderables.length).toBe(1);
        const renderable = renderables[0];

        // Check scale in transform matrix
        // Matrix is Float32Array(16)
        // Scale is at indices 0, 5, 10 for identity-based scaling
        const mat = renderable.transform as Float32Array;
        // With scale 1.5, diagonal elements should represent that (assuming no rotation)
        // interpolate(1.0, 2.0, 0.5) = 1.5
        expect(mat[0]).toBeCloseTo(1.5);
        expect(mat[5]).toBeCloseTo(1.5);
        expect(mat[10]).toBeCloseTo(1.5);
    });

    it('should interpolate alpha correctly', () => {
        // Setup mocks
        mockConfigStrings.set(ConfigStringIndex.Models + 1, 'models/test.md2');
        (mockAssets.getMd2Model as any).mockReturnValue(mockMd2Model);

        const stateA = createEntityStateFactory({
            number: 1,
            modelIndex: 1,
            alpha: 100 // 100/255
        });

        const stateB = createEntityStateFactory({
            ...stateA,
            alpha: 200 // 200/255
        });

        // Alpha = 0.5
        // Expected = 150
        const renderables = buildRenderableEntities([stateB], [stateA], 0.5, mockConfigStrings, mockImports);

        expect(renderables.length).toBe(1);
        const renderable = renderables[0];

        expect(renderable.alpha).toBeCloseTo(150 / 255);
    });

    it('should handle default alpha (0 or undefined) as 255', () => {
         // Setup mocks
         mockConfigStrings.set(ConfigStringIndex.Models + 1, 'models/test.md2');
         (mockAssets.getMd2Model as any).mockReturnValue(mockMd2Model);

         const stateA = createEntityStateFactory({
             number: 1,
             modelIndex: 1,
             alpha: 0 // Should be treated as 255
         });

         const stateB = createEntityStateFactory({
             ...stateA,
             alpha: 0
         });

         const renderables = buildRenderableEntities([stateB], [stateA], 0.5, mockConfigStrings, mockImports);

         expect(renderables.length).toBe(1);
         expect(renderables[0].alpha).toBe(1.0); // 255 / 255
    });
});
