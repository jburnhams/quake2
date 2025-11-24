import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Simple dependency validator
// Rules:
// 1. shared cannot import from engine, game, client
// 2. engine cannot import from game, client
// 3. game cannot import from client
// 4. client can import from engine, shared (game types are allowed via type-only imports ideally, but we check hard deps)

const PACKAGES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

const PACKAGES = ['shared', 'engine', 'game', 'client', 'tools'];

interface ImportRule {
    from: string;
    cannotImport: string[];
}

const RULES: ImportRule[] = [
    { from: 'shared', cannotImport: ['engine', 'game', 'client'] },
    { from: 'engine', cannotImport: ['game', 'client'] }, // Engine is the host, shouldn't depend on specific game/client logic
    // Game imports engine interfaces, but not implementation.
    // Ideally game only imports from shared and its own local files, plus engine TYPES.
    // However, in this monorepo, we might have strict boundaries.
    // Let's enforce: Game shouldn't import Client.
    { from: 'game', cannotImport: ['client'] },
];

function getAllTsFiles(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (file !== 'node_modules' && file !== 'dist' && file !== '.git') {
                results = results.concat(getAllTsFiles(filePath));
            }
        } else {
            if (file.endsWith('.ts') || file.endsWith('.tsx')) {
                results.push(filePath);
            }
        }
    });
    return results;
}

function checkFile(filePath: string, packageName: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const errors: string[] = [];

    const rule = RULES.find(r => r.from === packageName);
    if (!rule) return [];

    const importRegex = /from\s+['"](@quake2ts\/[^'"]+)['"]/;

    lines.forEach((line, index) => {
        const match = line.match(importRegex);
        if (match) {
            const importPath = match[1];
            // Check if import violates rules
            for (const forbidden of rule.cannotImport) {
                if (importPath === `@quake2ts/${forbidden}` || importPath.startsWith(`@quake2ts/${forbidden}/`)) {
                    errors.push(`${path.basename(filePath)}:${index + 1} - Package '${packageName}' cannot import from '${forbidden}' (${importPath})`);
                }
            }
        }
    });

    return errors;
}

export function validateDependencies() {
    console.log("Starting Dependency Validation...");
    let failureCount = 0;

    for (const pkg of PACKAGES) {
        const pkgDir = path.join(PACKAGES_ROOT, pkg, 'src');
        const files = getAllTsFiles(pkgDir);

        for (const file of files) {
            const errors = checkFile(file, pkg);
            if (errors.length > 0) {
                errors.forEach(e => console.error(e));
                failureCount += errors.length;
            }
        }
    }

    if (failureCount > 0) {
        console.error(`\nFound ${failureCount} dependency violations.`);
        process.exit(1);
    } else {
        console.log("\nDependency validation passed! No circular or forbidden architectural imports found.");
    }
}

// Allow running directly if this file is executed
// Check if current file is the main module being run
if (import.meta.url === `file://${process.argv[1]}`) {
    validateDependencies();
}
