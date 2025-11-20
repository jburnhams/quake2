import { describe, it, expect, vi } from 'vitest';
import { Draw_Init, Draw_InitFont, Draw_String, Draw_Char } from '../src/render/draw.js';
import { PakArchive } from '../src/assets/pak.js';
import * as pcx from '../../src/assets/pcx.js';

describe('draw', () => {
    it('should draw a string', async () => {
        const canvas = document.createElement('canvas');
        const ctx = {
            drawImage: vi.fn(),
            createImageData: vi.fn(() => ({ data: new Uint8ClampedArray(100) })),
        };
        vi.spyOn(canvas, 'getContext').mockReturnValue(ctx);
        document.body.innerHTML = '';
        document.body.appendChild(canvas);

        global.createImageBitmap = vi.fn(() => ({
            width: 10,
            height: 10
        }));

        Draw_Init(800, 600);
        vi.spyOn(pcx, 'parsePcx').mockReturnValue({
            width: 10,
            height: 10,
            pixels: new Uint8Array(100),
            palette: new Uint8Array(768),
        });
        const buffer = new ArrayBuffer(200);
        const view = new DataView(buffer);
        view.setUint32(0, 0x4b434150, true); // 'PACK'
        view.setUint32(4, 12, true); // dirOffset
        view.setUint32(8, 64, true); // dirLength
        const name = 'pics/conchars.pcx';
        for (let i = 0; i < name.length; i++) {
            view.setUint8(12 + i, name.charCodeAt(i));
        }
        view.setUint32(12 + 56, 100, true); // fileOffset
        view.setUint32(12 + 60, 100, true); // fileLength
        const pak = PakArchive.fromArrayBuffer('test.pak', buffer);
        await Draw_InitFont(pak);
        const drawImageSpy = vi.spyOn(ctx, 'drawImage');
        Draw_String(10, 10, 'hello');
        expect(drawImageSpy).toHaveBeenCalledTimes(5);
    });
});
