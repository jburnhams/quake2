
import { describe, it, expect, vi } from 'vitest';
import { renderFrame } from '../src/render/renderer';
import { Camera } from '../src/render/camera';

describe('Renderer', () => {
    it('should exist', () => {
        expect(renderFrame).toBeDefined();
    });
});
