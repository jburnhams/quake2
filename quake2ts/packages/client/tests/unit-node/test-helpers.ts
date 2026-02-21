import { vi } from 'vitest';
import { GetCGameAPI } from '@quake2ts/cgame';
import { Init_Hud } from '@quake2ts/client/hud.js';
import { createEmptyEntityState } from '@quake2ts/engine';
import { createMockCGameAPI } from '@quake2ts/test-utils';

export function resetCommonClientMocks() {
    // Reset mock return values due to mockReset: true in vitest.node.ts
    if (vi.isMockFunction(GetCGameAPI)) {
        vi.mocked(GetCGameAPI).mockReturnValue(createMockCGameAPI());
    }

    if (vi.isMockFunction(Init_Hud)) {
        vi.mocked(Init_Hud).mockResolvedValue(undefined);
    }

    if (vi.isMockFunction(createEmptyEntityState)) {
        vi.mocked(createEmptyEntityState).mockReturnValue({ origin: { x: 0, y: 0, z: 0 } } as any);
    }
}
