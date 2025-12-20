
import { Page } from 'playwright';
import path from 'path';
import fs from 'fs/promises';

export interface VisualDiff {
    pixelDiff: number;
    diffPath?: string;
    matched: boolean;
}

/**
 * Captures a screenshot of the current game state.
 */
export async function captureGameScreenshot(page: Page, name: string, options: { dir?: string, fullPage?: boolean } = {}): Promise<Buffer> {
    const dir = options.dir || '__screenshots__';
    const screenshotPath = path.join(dir, `${name}.png`);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    return await page.screenshot({
        path: screenshotPath,
        fullPage: options.fullPage ?? false,
        animations: 'disabled',
        caret: 'hide'
    });
}

/**
 * Compares two image buffers pixel-by-pixel.
 * Note: A robust implementation would use a library like 'pixelmatch' or 'looks-same'.
 * For now, we provide a basic placeholder or rely on simple buffer comparison.
 */
export async function compareScreenshots(baseline: Buffer, current: Buffer, threshold: number = 0.1): Promise<VisualDiff> {
    if (baseline.equals(current)) {
        return { pixelDiff: 0, matched: true };
    }

    return {
        pixelDiff: -1, // Unknown magnitude
        matched: false
    };
}

export interface VisualScenario {
    capture(name: string): Promise<Buffer>;
    compare(name: string, baselineDir: string): Promise<VisualDiff>;
}

/**
 * Creates a helper for visual regression testing scenarios.
 */
export function createVisualTestScenario(page: Page, sceneName: string): VisualScenario {
    return {
        async capture(snapshotName: string) {
            return await captureGameScreenshot(page, `${sceneName}-${snapshotName}`);
        },
        async compare(snapshotName: string, baselineDir: string) {
            const name = `${sceneName}-${snapshotName}`;
            const current = await captureGameScreenshot(page, name, { dir: '__screenshots__/current' });

            try {
                const baselinePath = path.join(baselineDir, `${name}.png`);
                const baseline = await fs.readFile(baselinePath);
                return await compareScreenshots(baseline, current);
            } catch (e) {
                return { pixelDiff: -1, matched: false };
            }
        }
    };
}
