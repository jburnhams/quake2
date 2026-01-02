import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCGameAPI, CGameImport, PmoveInfo } from '../../src/index.js';
import { PlayerState, UserCommand } from '@quake2ts/shared';
import * as shared from '@quake2ts/shared';

// We need to mock applyPmove in shared.
vi.mock('@quake2ts/shared', async (importOriginal) => {
    const actual = await importOriginal() as any;
    return {
        ...actual,
        applyPmove: vi.fn((state, cmd, trace, pointContents) => {
            // Return modified state
            return {
                ...state,
                origin: { x: state.origin.x + 10, y: state.origin.y, z: state.origin.z },
                velocity: { x: 100, y: 0, z: 0 },
                onGround: true,
                waterLevel: 0
            };
        })
    };
});

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

    it('should call applyPmove and update state', () => {
        const cgame = GetCGameAPI(mockImports);

        const state = {
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            onGround: false,
            waterLevel: 0,
        } as PlayerState;

        const cmd = {
            forwardmove: 100,
            sidemove: 0,
            upmove: 0,
            buttons: 0,
            msec: 100,
            angles: { x: 0, y: 0, z: 0 }
        } as UserCommand;

        const pmoveInfo: PmoveInfo = {
            s: state,
            cmd: cmd
        };

        cgame.Pmove(pmoveInfo);

        // Expect applyPmove to have been called (verified implicitly by result change due to mock)
        expect(pmoveInfo.s.origin.x).toBe(10);
        expect(pmoveInfo.s.velocity.x).toBe(100);
        expect(pmoveInfo.s.onGround).toBe(true);

        // Also verify trace was called (via adapter)
        // Check if shared.applyPmove was called.
        // Since we mocked it, we can import it and check.
        // NOTE: In Vitest, mocking via vi.mock happens before imports.
        // So importing '@quake2ts/shared' should give us the mocked version if configured correctly.
        // But since we are using ESM, `import * as shared` might be tricky with `vi.mock` if not handled carefully.
        // We can access the mock via the module object if we use `vi.importMock` or if we use the mocked implementation logic to set a flag.

        // Let's rely on the side effect: the state was updated.
        // If applyPmove wasn't called, origin.x would be 0.
    });

    it('should pass correct trace adapter to applyPmove', () => {
        const cgame = GetCGameAPI(mockImports);

        // We want to verify that the trace adapter passed to applyPmove actually calls PM_Trace

        // We can capture the trace adapter from the mock call
        let capturedTraceAdapter: any;

        // Update mock implementation to capture arguments
        const { applyPmove } = shared; // This might be the original or the mock depending on hoisting.
        // Wait, `vi.mock` is hoisted. `import` follows.

        // Let's assume the previous test confirmed applyPmove is called.
        // Now let's try to capture the callback.
        // We can't easily change the mock implementation inside the test if it's defined in vi.mock factory.
        // But we can use `vi.spyOn(shared, 'applyPmove')` if we didn't use `vi.mock` factory, but we need to mock it because it's an external module.

        // Instead, let's redefine the mock using a variable that we can access.
        // Vitest factories are isolated.

        // Alternative: Verify logic by ensuring trace calls happen if we simulate applyPmove logic.
        // But we are MOCKING applyPmove. So applyPmove logic is REPLACED.
        // So we can only verify that `applyPmove` was CALLED with SOME function.
        // To verify that function works, we'd need to execute it.

        // Let's modify the mock to execute the passed trace adapter.
        // (We already did that in the factory? No, we returned a fixed object).

        // We can make the mock call the trace adapter!
        // But we need to update the mock implementation.
        // Since `vi.mock` factory is static/hoisted, we can use `vi.mocked(shared.applyPmove).mockImplementation(...)`.

        // Let's try to update the mock implementation in this test.
        vi.mocked(shared.applyPmove).mockImplementation((state, cmd, trace, pointContents) => {
            // Call the trace adapter
            trace({x:0,y:0,z:0}, {x:10,y:0,z:0});
            return state;
        });

        const state = { origin: { x: 0, y: 0, z: 0 } } as PlayerState;
        const cmd = { } as UserCommand;

        cgame.Pmove({ s: state, cmd });

        expect(mockTrace).toHaveBeenCalled();
    });
});
