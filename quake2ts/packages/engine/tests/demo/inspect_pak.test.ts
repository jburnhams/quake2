import { describe, it, expect } from 'vitest';
import { PakArchive } from '../../src/assets/pak';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('Inspect PAK', () => {
    it('lists files in pak0.pak', () => {
        const pakPath = resolve(process.cwd(), '../../pak0.pak');

        if (!existsSync(pakPath)) {
            console.log('pak0.pak not found at', pakPath);
            return;
        }
        console.log('Reading PAK from', pakPath);
        const buffer = readFileSync(pakPath);
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

        const pak = PakArchive.fromArrayBuffer('pak0.pak', arrayBuffer);

        const files = [];
        for (const file of pak.entries.keys()) {
            if (file.endsWith('.dm2')) {
                files.push(file);
            }
        }
        console.log('Demos found:', files);
    });
});
