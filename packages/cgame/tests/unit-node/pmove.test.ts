import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCGameAPI, CGameImport, PmoveInfo } from '../../src/index.js';
import { PlayerState, UserCommand } from '@quake2ts/shared';
import { DEFAULT_PMOVE_TUNING, PmFlag, PmType, runPmove } from '@quake2ts/shared';

describe('CGame Pmove', () => {
    let mockImports: CGameImport;
    let mockTrace: any;

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks to ensure fresh state

        mockTrace = vi.fn().mockReturnValue({
            fraction: 1,
            endpos: { x: 0, y: 0, z: 0 },
            allsolid: false,
            startsolid: false
        });

        mockImports = {
            PM_Trace: mockTrace,
            CL_ClientTime: () => 0,
            // ... other stubs
            Com_Print: vi.fn(),
            Com_Error: vi.fn(),
            get_configstring: vi.fn(),
            TagMalloc: vi.fn(),
            TagFree: vi.fn(),
            FreeTags: vi.fn(),
            cvar: vi.fn(),
            cvar_set: vi.fn(),
            cvar_forceset: vi.fn(),
            CL_FrameValid: vi.fn(),
            CL_FrameTime: vi.fn(),
            CL_ServerFrame: vi.fn(),
            CL_ServerProtocol: vi.fn(),
            CL_GetClientName: vi.fn(),
            CL_GetClientPic: vi.fn(),
            CL_GetClientDogtag: vi.fn(),
            CL_GetKeyBinding: vi.fn(),
            RegisterModel: vi.fn(),
            RegisterSound: vi.fn(),
            Draw_RegisterPic: vi.fn(),
            Draw_GetPicSize: vi.fn(),
            SCR_DrawChar: vi.fn(),
            SCR_DrawPic: vi.fn(),
            SCR_DrawColorPic: vi.fn(),
            SCR_DrawFontString: vi.fn(),
            SCR_DrawCenterString: vi.fn(),
            SCR_MeasureFontString: vi.fn(),
            SCR_FontLineHeight: vi.fn(),
            SCR_SetAltTypeface: vi.fn(),
            SCR_DrawBind: vi.fn(),
            Localize: vi.fn(),
            CL_GetTextInput: vi.fn(),
            CL_GetWarnAmmoCount: vi.fn(),
            CL_InAutoDemoLoop: vi.fn(),
        } as unknown as CGameImport;
    });

    // Open space with a floor at z = 0: the player's box (mins.z -24) stands on it at z = 24.
    const floorTrace = (start: any, end: any, mins: any) => {
        const bottom = (mins?.z ?? 0);
        const floorZ = -bottom;
        if (end.z >= floorZ || start.z < floorZ) {
            return { fraction: 1, endpos: end, allsolid: false, startsolid: false, contents: 0 };
        }
        const fraction = (start.z - floorZ) / (start.z - end.z);
        const endpos = {
            x: start.x + (end.x - start.x) * fraction,
            y: start.y + (end.y - start.y) * fraction,
            z: floorZ,
        };
        return { fraction, endpos, allsolid: false, startsolid: false, planeNormal: { x: 0, y: 0, z: 1 }, contents: 1 };
    };

    const standing = () => ({
        origin: { x: 0, y: 0, z: 24 },
        velocity: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 0, z: 0 },
        onGround: true,
        waterLevel: 0,
        watertype: 0,
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
        pm_flags: PmFlag.OnGround,
        pm_type: PmType.Normal,
    }) as unknown as PlayerState;

    const forward = {
        forwardmove: 400,
        sidemove: 0,
        upmove: 0,
        buttons: 0,
        msec: 25,
        angles: { x: 0, y: 0, z: 0 },
    } as UserCommand;

    it('predicts with the server\'s move: the same origin and velocity runPmove gives', () => {
        mockTrace.mockImplementation(floorTrace);
        const cgame = GetCGameAPI(mockImports);
        const pmoveInfo: PmoveInfo = { s: standing(), cmd: forward };

        cgame.Pmove(pmoveInfo);

        const start = standing();
        const server = runPmove(
            {
                pmType: PmType.Normal,
                pmFlags: PmFlag.OnGround,
                origin: start.origin,
                velocity: start.velocity,
                angles: start.viewAngles,
                viewAngles: forward.angles,
                viewHeight: 22,
                waterlevel: 0,
                watertype: 0,
                cmd: { ...forward },
                delta_angles: { x: 0, y: 0, z: 0 },
                gravity: 800,
                mins: start.mins,
                maxs: start.maxs,
            },
            { trace: floorTrace as any, pointcontents: () => 0 },
            DEFAULT_PMOVE_TUNING,
        );

        expect(pmoveInfo.s.origin.x).toBeGreaterThan(0);
        expect(pmoveInfo.s.origin).toEqual(server.origin);
        expect(pmoveInfo.s.velocity).toEqual(server.velocity);
        expect(pmoveInfo.s.onGround).toBe(true);
    });

    it('traces through the client\'s PM_Trace', () => {
        mockTrace.mockImplementation(floorTrace);
        const cgame = GetCGameAPI(mockImports);

        cgame.Pmove({ s: standing(), cmd: forward });

        expect(mockTrace).toHaveBeenCalled();
    });
});
