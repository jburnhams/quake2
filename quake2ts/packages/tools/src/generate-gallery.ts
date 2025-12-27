import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function main() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error('Usage: generate-gallery <json-report-path>');
        process.exit(1);
    }

    const reportPath = args[0];

    if (!fs.existsSync(reportPath)) {
        console.error(`Report file not found: ${reportPath}`);
        // We exit gracefully if report is missing, assuming no visual tests ran
        return;
    }

    try {
        const reportData = fs.readFileSync(reportPath, 'utf-8');
        // Validate JSON
        const data = JSON.parse(reportData);

        console.log(`Valid visual-tests.json found with ${data.length} entries.`);

        const passed = data.filter((d: any) => d.stats?.passed).length;
        console.log(`Stats: ${passed} passed, ${data.length - passed} failed.`);

    } catch (error) {
        console.error('Error validating visual-tests.json:', error);
        process.exit(1);
    }
}

main();
