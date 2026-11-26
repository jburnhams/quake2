import { vi } from 'vitest';
import { GetCGameAPI } from '@quake2ts/cgame';
import { Init_Hud } from '@quake2ts/client/hud.js';
import { createEmptyEntityState } from '@quake2ts/engine';

export function resetCommonClientMocks() {
    // Reset mock return values due to mockReset: true in vitest.node.ts
    if (vi.isMockFunction(GetCGameAPI)) {
        vi.mocked(GetCGameAPI).mockReturnValue({
            Init: vi.fn(),
            Shutdown: vi.fn(),
            DrawHUD: vi.fn(),
            ParseCenterPrint: vi.fn(),
            NotifyMessage: vi.fn(),
            ParseConfigString: vi.fn(),
            ShowSubtitle: vi.fn()
        });
    }

    if (vi.isMockFunction(Init_Hud)) {
        vi.mocked(Init_Hud).mockResolvedValue(undefined);
    }

    if (vi.isMockFunction(createEmptyEntityState)) {
        vi.mocked(createEmptyEntityState).mockReturnValue({ origin: { x: 0, y: 0, z: 0 } } as any);
    }
}
