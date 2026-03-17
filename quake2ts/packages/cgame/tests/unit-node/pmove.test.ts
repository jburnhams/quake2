import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCGameAPI, CGameImport, PmoveInfo } from '../../src/index.js';
import { PlayerState, UserCommand } from '@quake2ts/shared';
import * as shared from '@quake2ts/shared';

// We need to mock applyPmove in shared.
vi.mock('@quake2ts/shared', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@quake2ts/shared')>();
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

import { createMockCGameImport } from '@quake2ts/test-utils';

describe('CGame Pmove', () => {
    let mockImports: CGameImport;
    let mockTrace: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks(); // Clear mocks to ensure fresh state

        mockTrace = vi.fn().mockReturnValue({
            fraction: 1,
            endpos: { x: 0, y: 0, z: 0 },
            allSolid: false,
            startSolid: false,
            plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
            ent: -1
        });

        mockImports = createMockCGameImport({
            PM_Trace: mockTrace,
            CL_ClientTime: vi.fn().mockReturnValue(0),
        });
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

        // Let's modify the mock to execute the passed trace adapter.
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
