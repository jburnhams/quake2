
import { describe, it, expect, beforeAll } from 'vitest';
import { resolve } from 'path';
import { readFileSync } from 'fs';
import { PakArchive } from '../../src/assets/pak';

describe('Real PAK Inspection', () => {
    let pak: PakArchive;

    beforeAll(() => {
        // Adjust path to point to workspace root
        const pakPath = resolve(__dirname, '../../../../pak.pak');
        const buffer = readFileSync(pakPath);
        pak = PakArchive.fromArrayBuffer('pak.pak', buffer.buffer);
    });

    it('should list files in pak.pak', () => {
        const entries = pak.listEntries();
        console.log("Files in pak.pak:");
        entries.forEach(e => console.log(`- ${e.name} (${e.length} bytes)`));

        const demoFiles = entries.filter(e => e.name.endsWith('.dm2'));
        expect(demoFiles.length).toBeGreaterThan(0);
        console.log("Demo files found:", demoFiles.map(d => d.name));
    });
});
