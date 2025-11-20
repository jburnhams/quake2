import { describe, it, expect, vi } from 'vitest';
import { Draw_Init, Draw_InitFont, Draw_String, Draw_Char } from '../src/render/draw.js';
import { PakArchive } from '../src/assets/pak.js';

describe('draw', () => {
    it('should draw a string', async () => {
        Draw_Init(800, 600);
        const pak = new PakArchive();
        await Draw_InitFont(pak);
        const canvas = document.querySelector('canvas');
        const ctx = canvas!.getContext('2d');
        const drawImageSpy = vi.spyOn(ctx!, 'drawImage');
        Draw_String(10, 10, 'hello');
        expect(drawImageSpy).toHaveBeenCalledTimes(5);
    });
});
