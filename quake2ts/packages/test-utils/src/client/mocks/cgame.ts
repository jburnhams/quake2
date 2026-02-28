import { vi } from 'vitest';
import type { CGameImport } from '@quake2ts/cgame';

/**
 * Creates a mock CGameImport object with all methods mocked.
 */
export function createMockCGameImport(overrides?: Partial<CGameImport>): CGameImport {
    return {
        Draw_RegisterPic: vi.fn(),
        Draw_GetPicSize: vi.fn().mockReturnValue({ width: 0, height: 0 }),
        SCR_DrawColorPic: vi.fn(),
        Com_Print: vi.fn(),
        SCR_DrawCenterString: vi.fn(),
        CL_ClientTime: vi.fn(),
        ...overrides
    } as unknown as CGameImport;
}
