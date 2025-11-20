import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Draw_Init, Draw_InitFont, Draw_String, Draw_Char } from '../src/render/draw.js';
import { PakArchive } from '../src/assets/pak.js';
import * as pcx from '../../src/assets/pcx.js';

describe('draw', () => {
    beforeEach(() => {
        // Clear document body before each test
        document.body.innerHTML = '';
    });

    afterEach(() => {
        // Clean up canvases after each test
        document.body.innerHTML = '';
    });

    it('should initialize and draw without errors', async () => {
        Draw_Init(800, 600);
        const canvas = document.querySelector('canvas');
        expect(canvas).toBeTruthy();

        // Drawing without font should not throw
        expect(() => Draw_String(10, 10, 'hello')).not.toThrow();
        expect(() => Draw_Char(10, 10, 65)).not.toThrow();
    });
});
