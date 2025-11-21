
import { describe, it, expect } from 'vitest';
import { Material, MaterialManager } from '../src/render/materials';

// Mock WebGLTexture
const createMockTexture = (): WebGLTexture => ({});

describe('Material', () => {
    it('should not animate if it has only one texture', () => {
        const texture = createMockTexture();
        const material = new Material([texture]);

        material.updateAnimation(0.1);
        expect(material.texture).toBe(texture);

        material.updateAnimation(0.2);
        expect(material.texture).toBe(texture);
    });

    it('should cycle through textures based on fps', () => {
        const texture1 = createMockTexture();
        const texture2 = createMockTexture();
        const material = new Material([texture1, texture2], 10); // 10 fps

        expect(material.texture).toBe(texture1);

        // Not enough time has passed
        material.updateAnimation(0.05);
        expect(material.texture).toBe(texture1);

        // Enough time has passed for one frame
        material.updateAnimation(0.1);
        expect(material.texture).toBe(texture2);

        // Another frame
        material.updateAnimation(0.2);
        expect(material.texture).toBe(texture1);
    });
});

describe('MaterialManager', () => {
    it('should update animations for all registered materials', () => {
        const manager = new MaterialManager();
        const texture1 = createMockTexture();
        const texture2 = createMockTexture();

        const material1 = new Material([texture1, texture2], 10);
        const material2 = new Material([texture2, texture1], 5);

        manager.registerMaterial('mat1', material1);
        manager.registerMaterial('mat2', material2);

        // Initial state
        expect(manager.getMaterial('mat1')?.texture).toBe(texture1);
        expect(manager.getMaterial('mat2')?.texture).toBe(texture2);

        // Update at 0.1s
        manager.updateAnimations(0.1);
        expect(manager.getMaterial('mat1')?.texture).toBe(texture2);
        expect(manager.getMaterial('mat2')?.texture).toBe(texture2); // Not enough time for 5fps

        // Update at 0.2s
        manager.updateAnimations(0.2);
        expect(manager.getMaterial('mat1')?.texture).toBe(texture1);
        expect(manager.getMaterial('mat2')?.texture).toBe(texture1);
    });
});
