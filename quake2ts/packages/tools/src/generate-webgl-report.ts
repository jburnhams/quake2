import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const WORKSPACE_ROOT = path.resolve(__dirname, '../../../');
const ENGINE_ROOT = path.join(WORKSPACE_ROOT, 'packages/engine');
const SNAPSHOTS_ROOT = path.join(ENGINE_ROOT, 'tests/webgl/visual/__snapshots__');
const STATS_DIR = path.join(SNAPSHOTS_ROOT, 'stats');
const OUTPUT_FILE = path.join(WORKSPACE_ROOT, 'webgl-visual-tests.json');

interface WebGLVisualTestResult {
  name: string;
  category: string;
  passed: boolean;
  percentDifferent: number;
  pixelsDifferent: number;
  totalPixels: number;
  baselineExists: boolean;
  hasActual: boolean;
  hasDiff: boolean;
  timestamp: number;
  width: number;
  height: number;
}

interface WebGLVisualReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  tests: WebGLVisualTestResult[];
}

interface TestStats {
  name: string;
  passed: boolean;
  percentDifferent: number;
  pixelsDifferent: number;
  totalPixels: number;
  width: number;
  height: number;
  diffPath?: string;
  actualPath?: string;
  baselinePath?: string;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function generateWebGLVisualReport(): Promise<void> {
  console.log('Generating WebGL visual test report...');
  console.log(`Stats directory: ${STATS_DIR}`);

  const report: WebGLVisualReport = {
    timestamp: new Date().toISOString(),
    totalTests: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    if (!await exists(STATS_DIR)) {
      console.warn(`Stats directory not found: ${STATS_DIR}`);
      // Write empty report so CI doesn't fail on missing artifact
      await fs.writeFile(OUTPUT_FILE, JSON.stringify(report, null, 2));
      return;
    }

    const files = await fs.readdir(STATS_DIR);
    const jsonFiles = files.filter(f => f.endsWith('.json'));

    console.log(`Found ${jsonFiles.length} stats files.`);

    for (const file of jsonFiles) {
      try {
        const filePath = path.join(STATS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats: TestStats = JSON.parse(content);

        // Determine category from name or path convention if applicable
        // WebGL tests might follow: category-testname or similar
        // For now, default to 'general' or try to parse
        let category = 'general';
        if (stats.name.includes('/')) {
          category = stats.name.split('/')[0];
        } else if (stats.name.includes('-')) {
             // Heuristic: take first part of dash-separated name as category
             // e.g. "hud-crosshair" -> "hud"
             category = stats.name.split('-')[0];
        }

        // Check for image files relative to snapshots root
        // The stats file name is typically "testname.json"
        // Images are in "testname.png" (baseline), "actual/testname.png", "diff/testname.png"
        // But the test name in vitest might contain slashes which are flattened or handled by vitest
        // We assume our custom matcher writes stats with a 'name' that matches the file structure

        // Since we are writing the matcher logic later (or it exists in test-utils),
        // we assume standard structure:
        // snapshots/testname.png
        // snapshots/actual/testname.png
        // snapshots/diff/testname.png

        const baselinePath = path.join(SNAPSHOTS_ROOT, `${stats.name}.png`);
        const actualPath = path.join(SNAPSHOTS_ROOT, 'actual', `${stats.name}.png`);
        const diffPath = path.join(SNAPSHOTS_ROOT, 'diff', `${stats.name}.png`);

        const result: WebGLVisualTestResult = {
          name: stats.name,
          category,
          passed: stats.passed,
          percentDifferent: stats.percentDifferent,
          pixelsDifferent: stats.pixelsDifferent,
          totalPixels: stats.totalPixels,
          baselineExists: await exists(baselinePath),
          hasActual: await exists(actualPath),
          hasDiff: await exists(diffPath),
          timestamp: Date.now(),
          width: stats.width,
          height: stats.height
        };

        report.tests.push(result);
        report.totalTests++;
        if (result.passed) {
          report.passed++;
        } else {
          report.failed++;
        }

      } catch (err) {
        console.error(`Error processing stats file ${file}:`, err);
      }
    }

    // Sort tests by name
    report.tests.sort((a, b) => a.name.localeCompare(b.name));

    await fs.writeFile(OUTPUT_FILE, JSON.stringify(report, null, 2));
    console.log(`Report generated at: ${OUTPUT_FILE}`);
    console.log(`Total: ${report.totalTests}, Passed: ${report.passed}, Failed: ${report.failed}`);

  } catch (err) {
    console.error('Failed to generate report:', err);
    process.exit(1);
  }
}

generateWebGLVisualReport();
