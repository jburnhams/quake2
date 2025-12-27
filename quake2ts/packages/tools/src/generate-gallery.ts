import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VisualTestResult {
  name: string;
  category: string;
  passed: boolean;
  percentDifferent: number;
  pixelsDifferent: number;
  totalPixels: number;
  baselineExists: boolean;
  hasActual: boolean;
  hasDiff: boolean;
  // Optional stats nesting depending on report format
  stats?: {
    passed: boolean;
    percentDifferent: number;
  }
}

interface VisualReport {
  timestamp: string;
  totalTests: number;
  passed: number;
  failed: number;
  tests: VisualTestResult[];
}

function generateHtml(report: VisualReport, renderer: 'webgpu' | 'webgl'): string {
  const title = renderer === 'webgpu' ? 'WebGPU Visual Tests' : 'WebGL Visual Tests';
  const snapshotsDir = renderer === 'webgpu' ? 'snapshots' : 'webgl-snapshots';

  const passRate = report.totalTests > 0 ? ((report.passed / report.totalTests) * 100).toFixed(1) : '0.0';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 20px; background: #f0f0f0; }
        .header { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .summary { display: flex; gap: 20px; font-size: 1.2em; }
        .stat { padding: 10px 20px; border-radius: 4px; font-weight: bold; }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .test-card { background: #fff; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .test-title { font-size: 1.2em; font-weight: bold; }
        .badge { padding: 4px 8px; border-radius: 4px; font-size: 0.9em; font-weight: bold; }
        .badge.pass { background: #d4edda; color: #155724; }
        .badge.fail { background: #f8d7da; color: #721c24; }
        .images { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .image-col { text-align: center; }
        .image-col img { max-width: 100%; border: 1px solid #ddd; border-radius: 4px; background: #eee; } /* checkboard pattern would be better */
        .image-col h4 { margin: 0 0 10px 0; color: #666; }
        .nav { margin-bottom: 20px; }
        .nav a { margin-right: 20px; text-decoration: none; color: #007bff; font-weight: bold; }
        .nav a.active { color: #0056b3; text-decoration: underline; }
    </style>
</head>
<body>
    <div class="nav">
        <a href="index.html" class="${renderer === 'webgpu' ? 'active' : ''}">WebGPU Results</a>
        <a href="webgl.html" class="${renderer === 'webgl' ? 'active' : ''}">WebGL Results</a>
    </div>

    <div class="header">
        <h1>${title}</h1>
        <div class="summary">
            <div class="stat passed">Passed: ${report.passed}</div>
            <div class="stat failed">Failed: ${report.failed}</div>
            <div class="stat">Total: ${report.totalTests}</div>
            <div class="stat">Pass Rate: ${passRate}%</div>
        </div>
    </div>

    <div class="tests">
        ${report.tests.map(test => {
            const isPass = test.passed || (test.stats && test.stats.passed);
            const diffPct = test.percentDifferent || (test.stats ? test.stats.percentDifferent : 0);
            return `
            <div class="test-card">
                <div class="test-header">
                    <div class="test-title">${test.name} <span style="font-weight:normal; font-size:0.8em; color:#666">(${test.category})</span></div>
                    <div>
                        <span class="badge ${isPass ? 'pass' : 'fail'}">
                            ${isPass ? 'PASS' : `FAIL (${diffPct.toFixed(4)}% diff)`}
                        </span>
                    </div>
                </div>
                <div class="images">
                    <div class="image-col">
                        <h4>Baseline</h4>
                        ${test.baselineExists ?
                            `<img src="${snapshotsDir}/baselines/${test.name}.png" alt="Baseline" loading="lazy">` :
                            '<div>No baseline</div>'}
                    </div>
                    <div class="image-col">
                        <h4>Actual</h4>
                        ${test.hasActual ?
                            `<img src="${snapshotsDir}/actual/${test.name}.png" alt="Actual" loading="lazy">` :
                            '<div>No output</div>'}
                    </div>
                    ${!isPass && test.hasDiff ? `
                    <div class="image-col">
                        <h4>Diff</h4>
                        <img src="${snapshotsDir}/diff/${test.name}.png" alt="Diff" loading="lazy">
                    </div>
                    ` : ''}
                </div>
            </div>
            `;
        }).join('')}
    </div>
</body>
</html>
  `;
}

function main() {
    // Usage: generate-gallery <json-report-path> <output-dir> [--renderer webgl|webgpu]
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: generate-gallery <json-report-path> <output-dir> [--renderer webgl|webgpu]');
        process.exit(1);
    }

    const reportPath = args[0];
    const outputDir = args[1];
    let renderer: 'webgpu' | 'webgl' = 'webgpu';

    if (args.includes('--renderer')) {
        const idx = args.indexOf('--renderer');
        if (args[idx + 1] === 'webgl') {
            renderer = 'webgl';
        }
    }

    if (!fs.existsSync(reportPath)) {
        console.error(`Report file not found: ${reportPath}`);
        return;
    }

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    try {
        const reportData = fs.readFileSync(reportPath, 'utf-8');
        let report: VisualReport;

        const rawData = JSON.parse(reportData);

        // Handle different report formats (array vs object)
        if (Array.isArray(rawData)) {
            // Legacy/WebGPU format might be array of results
            const tests = rawData as VisualTestResult[];
            const passed = tests.filter(t => t.passed || (t.stats && t.stats.passed)).length;
            report = {
                timestamp: new Date().toISOString(),
                totalTests: tests.length,
                passed,
                failed: tests.length - passed,
                tests
            };
        } else {
            // Object format (WebGL generator uses this)
            report = rawData as VisualReport;
        }

        const html = generateHtml(report, renderer);
        const filename = renderer === 'webgl' ? 'webgl.html' : 'index.html';
        const outputPath = path.join(outputDir, filename);

        fs.writeFileSync(outputPath, html);
        console.log(`Generated gallery at: ${outputPath}`);

    } catch (error) {
        console.error('Error generating gallery:', error);
        process.exit(1);
    }
}

main();
