import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// This script is located in quake2ts/packages/tools/
// We need to go up two levels to get to quake2ts/
const ROOT_DIR = path.resolve(__dirname, '..', '..');
const ROOT_PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');
const PACKAGES_DIR = path.join(ROOT_DIR, 'packages');

// Read the root package.json
if (!fs.existsSync(ROOT_PACKAGE_PATH)) {
    console.error(`Error: Root package.json not found at ${ROOT_PACKAGE_PATH}`);
    process.exit(1);
}

const rootPackage = JSON.parse(fs.readFileSync(ROOT_PACKAGE_PATH, 'utf8'));
const newVersion = rootPackage.version;

console.log(`Syncing version ${newVersion} to subpackages...`);

// Iterate through subdirectories in 'packages'
if (fs.existsSync(PACKAGES_DIR)) {
    const packages = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true });

    packages.forEach(dirent => {
        if (dirent.isDirectory()) {
            const packageJsonPath = path.join(PACKAGES_DIR, dirent.name, 'package.json');

            if (fs.existsSync(packageJsonPath)) {
                try {
                    const pkgContent = fs.readFileSync(packageJsonPath, 'utf8');
                    const pkg = JSON.parse(pkgContent);

                    if (pkg.version !== newVersion) {
                        console.log(`Updating ${dirent.name} from ${pkg.version} to ${newVersion}`);
                        pkg.version = newVersion;

                        // Preserve formatting
                        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');
                    } else {
                        console.log(`Skipping ${dirent.name} (already at ${newVersion})`);
                    }
                } catch (err) {
                    console.error(`Error processing ${dirent.name}:`, err.message);
                }
            }
        }
    });
} else {
    console.error(`Error: Packages directory not found at ${PACKAGES_DIR}`);
    process.exit(1);
}

console.log('Version sync complete.');
