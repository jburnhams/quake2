import { describe, it, expect, vi } from 'vitest';
import { CGameExports, CGameImports, PlayerClient } from '@quake2ts/shared/dist/cgame/interfaces';
import * as cgame from '../src/cg_main';
import { PlayerState } from '@quake2ts/shared';
import { PredictionState } from '../src/prediction';

describe('CGame Integration', () => {
    it('should initialize and draw a frame', () => {
        const mockImports: CGameImports = {
            renderer: {
                begin2D: vi.fn(),
                end2D: vi.fn(),
                drawPic: vi.fn(),
                drawString: vi.fn(),
                drawCenterString: vi.fn(),
                drawfillRect: vi.fn(),
                registerTexture: vi.fn(),
                stats: {} as any,
            } as any,
            assets: {
                loadTexture: vi.fn(),
            } as any,
            trace: vi.fn(),
        } as any;

        const cgameExports = cgame.Init(mockImports);
        cgameExports.Init();

        const ps = {} as PlayerState;
        const client = {} as PlayerClient;
        const pred = { health: 100, armor: 100, ammo: 100 } as PredictionState;

        cgameExports.DrawActiveFrame(0, false, false, client, ps, pred, 100);

        expect(mockImports.renderer.begin2D).toHaveBeenCalled();
        expect(mockImports.renderer.end2D).toHaveBeenCalled();
    });
});
