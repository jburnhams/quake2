import { describe, it, expect } from 'vitest';
import { compareSnapshots } from '../../src/visual/snapshots';

describe('compareSnapshots', () => {
    it('returns passed=true for identical images', async () => {
        const width = 2;
        const height = 1;
        const img1 = new Uint8ClampedArray([
            255, 0, 0, 255,  0, 255, 0, 255
        ]);
        const img2 = new Uint8ClampedArray([
            255, 0, 0, 255,  0, 255, 0, 255
        ]);

        const result = await compareSnapshots(img1, img2, width, height);

        expect(result.passed).toBe(true);
        expect(result.pixelsDifferent).toBe(0);
        expect(result.percentDifferent).toBe(0);
    });

    it('returns passed=false for different images', async () => {
        const width = 2;
        const height = 1;
        const img1 = new Uint8ClampedArray([
            255, 0, 0, 255,  0, 255, 0, 255
        ]);
        const img2 = new Uint8ClampedArray([
            255, 0, 0, 255,  0, 0, 255, 255 // Second pixel is blue instead of green
        ]);

        const result = await compareSnapshots(img1, img2, width, height);

        expect(result.passed).toBe(false);
        expect(result.pixelsDifferent).toBe(1);
        expect(result.percentDifferent).toBe(50); // 1 out of 2 pixels different
    });

    it('respects thresholds', async () => {
        const width = 1;
        const height = 1;
        const img1 = new Uint8ClampedArray([100, 100, 100, 255]);
        const img2 = new Uint8ClampedArray([105, 100, 100, 255]); // Slightly different red channel

        // With strict threshold
        const strictResult = await compareSnapshots(img1, img2, width, height, { threshold: 0.01 });
        expect(strictResult.pixelsDifferent).toBe(1);

        // With loose threshold
        // 5/255 difference is approx 0.019
        const looseResult = await compareSnapshots(img1, img2, width, height, { threshold: 0.1 });
        expect(looseResult.pixelsDifferent).toBe(0);
        expect(looseResult.passed).toBe(true);
    });

    it('generates a diff image', async () => {
        const width = 2;
        const height = 1;
        const img1 = new Uint8ClampedArray([
            255, 255, 255, 255,  255, 255, 255, 255
        ]);
        const img2 = new Uint8ClampedArray([
            0, 0, 0, 255,        255, 255, 255, 255
        ]);

        const result = await compareSnapshots(img1, img2, width, height);

        expect(result.diffImage).toBeDefined();
        expect(result.diffImage?.length).toBe(width * height * 4);

        // pixelmatch highlights differences in red (default) on the diff image
        // The first pixel is different, so it should be red [255, 0, 0, 255]
        const diff = result.diffImage!;
        expect(diff[0]).toBe(255);
        expect(diff[1]).toBe(0);
        expect(diff[2]).toBe(0);
        expect(diff[3]).toBe(255);
    });

    it('throws on size mismatch', async () => {
        const img1 = new Uint8ClampedArray(4);
        const img2 = new Uint8ClampedArray(8);

        await expect(compareSnapshots(img1, img2, 1, 1)).rejects.toThrow(/Size mismatch/);
    });
});
