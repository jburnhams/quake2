import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { savePNG, loadPNG, captureFramebufferAsPNG } from '../../src/visual/snapshots';
import fs from 'fs/promises';
import path from 'path';

describe('PNG Utilities', () => {
    const tmpDir = path.join(__dirname, 'tmp');

    beforeEach(async () => {
        await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('round-trip preserves pixel data', async () => {
        const width = 2;
        const height = 2;
        const pixels = new Uint8ClampedArray([
            255, 0, 0, 255,   0, 255, 0, 255,
            0, 0, 255, 255,   255, 255, 0, 255
        ]);
        const filepath = path.join(tmpDir, 'test.png');

        await savePNG(pixels, width, height, filepath);

        const exists = await fs.stat(filepath).then(() => true).catch(() => false);
        expect(exists).toBe(true);

        const loaded = await loadPNG(filepath);
        expect(loaded.width).toBe(width);
        expect(loaded.height).toBe(height);
        expect(loaded.data).toEqual(pixels);
    });

    it('can save and load a larger image', async () => {
        const width = 10;
        const height = 10;
        const pixels = new Uint8ClampedArray(width * height * 4);
        // Fill with gradient
        for (let i = 0; i < pixels.length; i += 4) {
            pixels[i] = i % 255;
            pixels[i + 1] = (i + 100) % 255;
            pixels[i + 2] = (i + 200) % 255;
            pixels[i + 3] = 255;
        }

        const filepath = path.join(tmpDir, 'gradient.png');
        await savePNG(pixels, width, height, filepath);

        const loaded = await loadPNG(filepath);
        expect(loaded.width).toBe(width);
        expect(loaded.height).toBe(height);
        expect(loaded.data).toEqual(pixels);
    });
});
