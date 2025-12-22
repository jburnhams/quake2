import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { expectSnapshot, getSnapshotPath, savePNG } from '../../src/visual/snapshots';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

describe('expectSnapshot', () => {
    const tmpDir = path.join(__dirname, 'tmp_snapshots');
    const snapshotDir = path.join(tmpDir, '__snapshots__');

    beforeEach(async () => {
        await fs.mkdir(tmpDir, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('creates baseline if it does not exist', async () => {
        const width = 2;
        const height = 1;
        const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
        const name = 'new-test';

        await expectSnapshot(pixels, { name, width, height, snapshotDir });

        const baselinePath = getSnapshotPath(name, 'baseline', snapshotDir);
        expect(existsSync(baselinePath)).toBe(true);
    });

    it('passes if pixels match baseline', async () => {
        const width = 2;
        const height = 1;
        const pixels = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
        const name = 'passing-test';

        // Create baseline first
        await expectSnapshot(pixels, { name, width, height, snapshotDir });

        // Run again with same pixels
        await expect(expectSnapshot(pixels, { name, width, height, snapshotDir })).resolves.not.toThrow();
    });

    it('fails if pixels do not match baseline', async () => {
        const width = 2;
        const height = 1;
        const pixels1 = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
        const pixels2 = new Uint8ClampedArray([0, 0, 255, 255, 0, 255, 0, 255]); // First pixel different
        const name = 'failing-test';

        // Create baseline
        await expectSnapshot(pixels1, { name, width, height, snapshotDir });

        // Run with different pixels
        await expect(expectSnapshot(pixels2, { name, width, height, snapshotDir }))
            .rejects.toThrow(/Snapshot comparison failed/);

        // Check actual and diff exist
        const actualPath = getSnapshotPath(name, 'actual', snapshotDir);
        const diffPath = getSnapshotPath(name, 'diff', snapshotDir);
        expect(existsSync(actualPath)).toBe(true);
        expect(existsSync(diffPath)).toBe(true);
    });

    it('updates baseline if requested', async () => {
        const width = 2;
        const height = 1;
        const pixels1 = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]);
        const pixels2 = new Uint8ClampedArray([0, 0, 255, 255, 0, 255, 0, 255]);
        const name = 'update-test';

        // Create baseline
        await expectSnapshot(pixels1, { name, width, height, snapshotDir });

        // Run with update flag
        await expectSnapshot(pixels2, { name, width, height, snapshotDir, updateBaseline: true });

        // Verify baseline updated (check implicit by running again without update)
        await expectSnapshot(pixels2, { name, width, height, snapshotDir });
    });
});
