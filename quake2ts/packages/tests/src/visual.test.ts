import { describe, it, expect } from 'vitest';
import { createCanvas } from '@napi-rs/canvas';
import { takeScreenshot } from './visual.js';
import fs from 'fs/promises';
import path from 'path';

describe('Visual Regression Helpers', () => {
    const outputDir = path.join(__dirname, '../../__screenshots__');

    it('should save a canvas to a PNG file', async () => {
        const canvas = createCanvas(100, 100);
        const ctx = canvas.getContext('2d');

        // Draw a red rectangle
        ctx.fillStyle = 'red';
        ctx.fillRect(10, 10, 80, 80);

        const filePath = path.join(outputDir, 'test-rect.png');

        // Ensure clean state
        try { await fs.unlink(filePath); } catch {}

        await takeScreenshot(canvas, filePath);

        // Verify file exists
        const stats = await fs.stat(filePath);
        expect(stats.size).toBeGreaterThan(0);

        // Cleanup
        // await fs.unlink(filePath);
    });
});
