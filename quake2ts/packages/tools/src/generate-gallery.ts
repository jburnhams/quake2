import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface VisualTestInfo {
  testName: string;
  snapshotName: string;
  file: string;
  line: number;
  description: string;
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
        .test-case { background: #2a2a2a; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
        .test-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .test-name { font-size: 1.2em; font-weight: bold; color: #4CAF50; }
        .test-meta { font-size: 0.9em; color: #888; }
        .test-meta a { color: #888; text-decoration: none; }
        .test-meta a:hover { text-decoration: underline; }
        .comparison { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; text-align: center; }
        .image-col { background: #000; padding: 10px; border-radius: 4px; }
        .image-col img { max-width: 100%; height: auto; display: block; margin: 10px auto; image-rendering: pixelated; }
        .label { font-size: 0.8em; text-transform: uppercase; color: #aaa; margin-bottom: 5px; }
        .nav { margin-bottom: 20px; }
        .nav a { color: #4CAF50; text-decoration: none; margin-right: 15px; }
    </style>
</head>
<body>
    <div class="nav">
        <a href="index.html">← Back to Home</a>
    </div>
    <h1>Visual Tests Gallery</h1>
    <div id="gallery"></div>
    <script>
        const galleryData = {{DATA}};
        const gallery = document.getElementById('gallery');

        galleryData.forEach(test => {
            const div = document.createElement('div');
            div.className = 'test-case';

            const baselinePath = 'snapshots/baselines/' + test.snapshotName + '.png';
            const actualPath = 'snapshots/actual/' + test.snapshotName + '.png';
            const diffPath = 'snapshots/diff/' + test.snapshotName + '.png';

            const ghLink = 'https://github.com/jburnhams/quake2/blob/main/' + test.file + '#L' + test.line;

            div.innerHTML = \`
                <div class="test-header">
                    <div>
                        <div class="test-name">\${test.testName}</div>
                        <div class="test-meta">\${test.description}</div>
                    </div>
                    <div class="test-meta">
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
            gallery.appendChild(div);
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
