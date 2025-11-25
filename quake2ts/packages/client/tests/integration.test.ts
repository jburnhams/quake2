import { describe, it, expect, vi } from 'vitest';
import { createClient } from '../src';
import * as cgame from '@quake2ts/cgame';
import { CGameExports } from '@quake2ts/shared/dist/cgame/interfaces';

describe('Client Integration', () => {
    it('should create a client instance and delegate calls to cgame', () => {
        // Mock cgame module
        const mockCGame: CGameExports = {
            Init: vi.fn(),
            Shutdown: vi.fn(),
            DrawActiveFrame: vi.fn(),
        };
        vi.spyOn(cgame, 'Init').mockReturnValue(mockCGame);

        // Mock engine imports
        const mockEngineImports = {
            renderer: { stats: {} },
            trace: vi.fn(),
            assets: {},
        };

        const client = createClient({ engine: mockEngineImports as any });
        expect(client).toBeDefined();

        client.init({} as any);
        expect(mockCGame.Init).toHaveBeenCalled();

        client.render({ latest: { state: { client: {} } } } as any);
        expect(mockCGame.DrawActiveFrame).toHaveBeenCalled();

        client.shutdown();
        expect(mockCGame.Shutdown).toHaveBeenCalled();
    });
});
