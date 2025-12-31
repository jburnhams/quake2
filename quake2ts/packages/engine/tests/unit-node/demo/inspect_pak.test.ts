
import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { PakArchive } from '../../../src/assets/pak.js';

describe('Real PAK Inspection', () => {
    let pak: PakArchive;

    beforeAll(() => {
        // Try multiple strategies to find pak.pak
        let pakPath = resolve(process.cwd(), 'pak.pak');

        if (!existsSync(pakPath)) {
            // Try relative to __dirname (5 levels up)
            pakPath = resolve(__dirname, '../../../../../pak.pak');
        }

        if (!existsSync(pakPath)) {
             // Try relative to workspace root if cwd is package
             if (process.cwd().endsWith('packages/engine')) {
                 pakPath = resolve(process.cwd(), '../../pak.pak');
             }
        }

        if (!existsSync(pakPath)) {
            // Last resort: assume we are in root and it is just pak.pak, but maybe tests run from somewhere else
            // Try 4 levels up just in case
            pakPath = resolve(__dirname, '../../../../pak.pak');
        }

        console.log(`[InspectPak] Resolving pak.pak from: ${pakPath} (cwd: ${process.cwd()}, __dirname: ${__dirname})`);

        const buffer = readFileSync(pakPath);
        pak = PakArchive.fromArrayBuffer('pak.pak', buffer.buffer);
    });

    it('should list files in pak.pak', () => {
        const entries = pak.listEntries();
        // console.log("Files in pak.pak:");
        // entries.forEach(e => console.log(`- ${e.name} (${e.length} bytes)`));

        const demoFiles = entries.filter(e => e.name.endsWith('.dm2'));
        expect(demoFiles.length).toBeGreaterThan(0);
        // console.log("Demo files found:", demoFiles.map(d => d.name));
    });
});
