import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VisualTestStats {
    passed: boolean;
    percentDifferent: number;
    pixelsDifferent: number;
    totalPixels: number;
    threshold: number;
    maxDifferencePercent: number;
}

interface VisualTestInfo {
  testName: string;
  snapshotName: string;
  file: string;
  line: number;
  description: string;
  stats?: VisualTestStats;
}

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Quake2TS Visual Tests</title>
    <style>
        body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #1a1a1a; color: #eee; }
        h1 { border-bottom: 1px solid #333; padding-bottom: 10px; }
        .file-section { margin-bottom: 20px; border: 1px solid #444; border-radius: 8px; overflow: hidden; }
        .file-header {
            background: #2a2a2a;
            padding: 15px 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
            transition: background 0.2s;
        }
        .file-header:hover { background: #333; }
        .file-title { font-size: 1.1em; font-weight: bold; color: #eee; display: flex; align-items: center; gap: 10px; }
        .file-stats { font-size: 0.9em; color: #888; }
        .file-content { display: none; padding: 20px; background: #222; border-top: 1px solid #444; }
        .file-content.expanded { display: block; }

        .test-case { background: #2a2a2a; border-radius: 8px; padding: 20px; margin-bottom: 20px; border: 1px solid #333; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .test-name { font-size: 1.2em; font-weight: bold; color: #4CAF50; display: flex; align-items: center; gap: 10px; }
        .test-meta { font-size: 0.9em; color: #888; }
        .test-meta a { color: #888; text-decoration: none; }
        .test-meta a:hover { text-decoration: underline; }
        .comparison { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; }
        .image-col { background: #000; padding: 10px; border-radius: 4px; }
        .image-col img { max-width: 100%; height: auto; display: block; margin: 10px auto; image-rendering: pixelated; }
        .label { font-size: 0.8em; text-transform: uppercase; color: #aaa; margin-bottom: 5px; }
        .nav { margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
        .nav a { color: #4CAF50; text-decoration: none; margin-right: 15px; }
        .status-icon { font-size: 1.2em; }
        .status-pass { color: #4CAF50; }
        .status-fail { color: #F44336; }
        .stats-badge {
            background: #444;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-left: 10px;
            cursor: help;
        }
        .toggle-btn {
            background: #444;
            color: #eee;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
        }
        .toggle-btn:hover { background: #555; }
        .footer-controls { margin-top: 40px; text-align: center; padding-top: 20px; border-top: 1px solid #333; }

        /* Copy Button Styles */
        .copy-btn {
            background: transparent;
            color: #888;
            border: 1px solid #444;
            padding: 4px 8px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
            transition: all 0.2s;
            font-size: 0.9em;
        }
        .copy-btn:hover {
            background: #444;
            color: #fff;
            border-color: #555;
        }
        .copy-btn:active {
            transform: translateY(1px);
        }
    </style>
</head>
<body>
    <div class="nav">
        <a href="index.html">← Back to Home</a>
    </div>
    <h1>Visual Tests Gallery</h1>

    <div style="margin-bottom: 20px;">
        <button id="toggle-all-top" class="toggle-btn" onclick="toggleAll()">Expand All</button>
    </div>

    <div id="gallery"></div>

    <div class="footer-controls">
        <button id="toggle-all-bottom" class="toggle-btn" onclick="toggleAll()">Expand All</button>
    </div>

    <script>
        const galleryData = {{DATA}};
        const gallery = document.getElementById('gallery');
        let allExpanded = false;

        function toggleAll() {
            allExpanded = !allExpanded;
            const contents = document.querySelectorAll('.file-content');
            contents.forEach(content => {
                if (allExpanded) {
                    content.classList.add('expanded');
                } else {
                    content.classList.remove('expanded');
                }
            });

            const btnText = allExpanded ? 'Collapse All' : 'Expand All';
            document.getElementById('toggle-all-top').textContent = btnText;
            document.getElementById('toggle-all-bottom').textContent = btnText;
        }

        // Group tests by file
        const groups = {};
        galleryData.forEach(test => {
            if (!groups[test.file]) {
                groups[test.file] = [];
            }
            groups[test.file].push(test);
        });

        // Render groups
        Object.keys(groups).sort().forEach(filePath => {
            const tests = groups[filePath];
            const fileName = filePath.split('/').pop();

            // Calculate stats
            let passed = 0;
            let failed = 0;
            tests.forEach(t => {
                if (t.stats && t.stats.passed) passed++;
                else failed++;
            });

            const section = document.createElement('div');
            section.className = 'file-section';

            // Header
            const header = document.createElement('div');
            header.className = 'file-header';
            header.title = filePath; // Tooltip with full path
            header.onclick = () => {
                const content = section.querySelector('.file-content');
                content.classList.toggle('expanded');
            };

            const failStyle = failed > 0 ? 'color: #F44336' : 'color: #4CAF50';
            header.innerHTML = \`
                <div class="file-title">
                    <span style="\${failStyle}">\${failed > 0 ? '✗' : '✓'}</span>
                    \${fileName}
                </div>
                <div class="file-stats">
                    <span style="color: #4CAF50">\${passed} passed</span>,
                    <span style="color: #F44336">\${failed} failed</span>
                </div>
            \`;
            section.appendChild(header);

            // Content
            const content = document.createElement('div');
            content.className = 'file-content';

            tests.forEach(test => {
                const div = document.createElement('div');
                div.className = 'test-case';

                const baselinePath = 'snapshots/baselines/' + test.snapshotName + '.png';
                const actualPath = 'snapshots/actual/' + test.snapshotName + '.png';
                const diffPath = 'snapshots/diff/' + test.snapshotName + '.png';

                // Fix: Prepend quake2ts/ to the link path
                const ghLink = 'https://github.com/jburnhams/quake2/blob/main/quake2ts/' + test.file + '#L' + test.line;

                const descriptionHtml = test.description && test.description !== test.testName
                    ? \`<div class="test-meta">\${test.description}</div>\`
                    : '';

                let statusHtml = '';
                let statsHtml = '';

                if (test.stats) {
                    const isPass = test.stats.passed;
                    const icon = isPass ? '✓' : '✗';
                    const statusClass = isPass ? 'status-pass' : 'status-fail';
                    const percentMatch = (100 - test.stats.percentDifferent).toFixed(2);

                    const tooltip = \`Pixels Different: \${test.stats.pixelsDifferent} / \${test.stats.totalPixels}
Error: \${test.stats.percentDifferent.toFixed(4)}%
Max Allowed: \${test.stats.maxDifferencePercent}%
Threshold: \${test.stats.threshold}\`;

                    statusHtml = \`<span class="status-icon \${statusClass}">\${icon}</span>\`;
                    statsHtml = \`<span class="stats-badge" title="\${tooltip}">Match: \${percentMatch}%</span>\`;
                }

                const copyText = \`\${fileName} - \${test.testName}\${(test.description && test.description !== test.testName) ? ' - ' + test.description : ''}\`;
                // Escape HTML attributes for data-clipboard-text
                const copyTextAttr = copyText.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

                div.innerHTML = \`
                    <div class="test-header">
                        <div>
                            <div class="test-name">
                                \${statusHtml}
                                \${test.testName}
                                \${statsHtml}
                            </div>
                            \${descriptionHtml}
                        </div>
                        <div class="test-meta">
                            <button class="copy-btn" data-clipboard-text="\${copyTextAttr}" onclick="navigator.clipboard.writeText(this.dataset.clipboardText)" title="Copy to clipboard">📋</button>
                            <a href="\${ghLink}" target="_blank">View Code ↗</a>
                        </div>
                    </div>
                    <div class="comparison">
                        <div class="image-col">
                            <div class="label">Reference</div>
                            <img src="\${baselinePath}" onerror="this.style.display='none'; this.parentElement.innerHTML+='<div style=\\'padding:20px;color:#666\\'>Missing</div>'">
                        </div>
                        <div class="image-col">
                            <div class="label">Actual</div>
                            <img src="\${actualPath}" onerror="this.style.display='none'; this.parentElement.innerHTML+='<div style=\\'padding:20px;color:#666\\'>Missing</div>'">
                        </div>
                        <div class="image-col">
                            <div class="label">Difference</div>
                            <img src="\${diffPath}" onerror="this.style.display='none'; this.parentElement.innerHTML+='<div style=\\'padding:20px;color:#666\\'>No Diff</div>'">
                        </div>
                    </div>
                \`;
                content.appendChild(div);
            });

            section.appendChild(content);
            gallery.appendChild(section);
        });
    </script>
</body>
</html>`;

function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: generate-gallery <json-report-path> <output-dir>');
        process.exit(1);
    }

    const reportPath = args[0];
    const outputDir = args[1];

    if (!fs.existsSync(reportPath)) {
        console.error(`Report file not found: ${reportPath}`);
        // We exit gracefully if report is missing, assuming no visual tests ran
        return;
    }

    try {
        const reportData = fs.readFileSync(reportPath, 'utf-8');
        // Validate JSON
        JSON.parse(reportData);

        const html = HTML_TEMPLATE.replace('{{DATA}}', reportData);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, 'visual-tests.html');
        fs.writeFileSync(outputPath, html);
        console.log(`Generated gallery at ${outputPath}`);

    } catch (error) {
        console.error('Error generating gallery:', error);
        process.exit(1);
    }
}

main();
