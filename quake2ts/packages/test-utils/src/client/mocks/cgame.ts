import { vi } from 'vitest';
import type { CGameImport } from '@quake2ts/cgame';

/**
 * Creates a mock CGameImport object with all methods mocked,
 * satisfying the full CGameImport interface.
 */
export function createMockCGameImport(overrides?: Partial<CGameImport>): CGameImport {
    return {
        tick_rate: 10,
        frame_time_s: 0.1,
        frame_time_ms: 100,

        Com_Print: vi.fn(),
        Com_Error: vi.fn(),

        get_configstring: vi.fn().mockReturnValue(''),

        TagMalloc: vi.fn(),
        TagFree: vi.fn(),
        FreeTags: vi.fn(),

        cvar: vi.fn().mockReturnValue({ value: 0 }),
        Cvar_Get: vi.fn().mockReturnValue({ value: 0 }),
        cvar_set: vi.fn(),
        cvar_forceset: vi.fn(),

        CL_FrameValid: vi.fn().mockReturnValue(true),
        CL_FrameTime: vi.fn().mockReturnValue(100),
        CL_ClientTime: vi.fn().mockReturnValue(1000),
        CL_ServerFrame: vi.fn().mockReturnValue(1),
        CL_ServerProtocol: vi.fn().mockReturnValue(34),

        CL_GetClientName: vi.fn().mockReturnValue('Player'),
        CL_GetClientPic: vi.fn().mockReturnValue(''),
        CL_GetClientDogtag: vi.fn().mockReturnValue(''),
        CL_GetKeyBinding: vi.fn().mockReturnValue(''),

        RegisterModel: vi.fn(),
        RegisterSound: vi.fn(),

        Draw_RegisterPic: vi.fn().mockReturnValue({}),
        Draw_GetPicSize: vi.fn().mockReturnValue({ width: 0, height: 0 }),
        SCR_DrawChar: vi.fn(),
        SCR_DrawPic: vi.fn(),
        SCR_DrawColorPic: vi.fn(),
        SCR_DrawFontString: vi.fn(),
        SCR_DrawCenterString: vi.fn(),
        SCR_MeasureFontString: vi.fn().mockReturnValue(0),
        SCR_FontLineHeight: vi.fn().mockReturnValue(10),
        SCR_SetAltTypeface: vi.fn(),
        SCR_DrawBind: vi.fn(),

        Localize: vi.fn().mockImplementation((key: string) => key),

        CL_GetTextInput: vi.fn().mockReturnValue(''),
        CL_GetWarnAmmoCount: vi.fn().mockReturnValue(0),
        CL_InAutoDemoLoop: vi.fn().mockReturnValue(false),

        PM_Trace: vi.fn().mockReturnValue({
            allSolid: false,
            startSolid: false,
            fraction: 1,
            endpos: { x: 0, y: 0, z: 0 },
            plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
            ent: -1
        }),

        ...overrides
    };
}
