import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { savePNG } from '../../src/visual/snapshots';
import fs from 'fs/promises';
import path from 'path';

describe('Visual Regression Helpers', () => {
    // Adjust output dir to be relative to the new test location
    const outputDir = path.join(__dirname, '../../../__screenshots__');

    it('should save a canvas to a PNG file using savePNG', async () => {
        const width = 100;
        const height = 100;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Draw a red rectangle
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, 80, 80);

        const filePath = path.join(outputDir, 'test-rect-savePNG.png');

        // Ensure clean state
        try { await fs.unlink(filePath); } catch {}

        // Get pixel data
        const imageData = ctx.getImageData(0, 0, width, height);

        // Use the utility function
        await savePNG(imageData.data, width, height, filePath);

        // Verify file exists
        const stats = await fs.stat(filePath);
        expect(stats.size).toBeGreaterThan(0);

        // Cleanup
        // await fs.unlink(filePath);
    });
});
