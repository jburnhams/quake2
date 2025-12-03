import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCGameAPI, CGameImport, CGameExport } from '../src/index';
import { PmoveInfo } from '../src/types';

describe('CGame Prediction CVars', () => {
    let cgame: CGameExport;
    let mockImport: CGameImport;
    let mockCvars: Record<string, { value: number }> = {};

    beforeEach(() => {
        mockCvars = {};
        mockImport = {
            Cvar_Get: vi.fn((name, val, flags) => {
                const cvar = { value: parseInt(val) };
                mockCvars[name] = cvar;
                return cvar;
            }),
            Com_Print: vi.fn(),
            PM_Trace: vi.fn().mockReturnValue({ fraction: 1.0, contents: 0, endpos: { x: 1, y: 0, z: 0 } }), // Ensure trace returns valid endpos
            CL_ClientTime: vi.fn().mockReturnValue(1000),
            // Mock other required methods to avoid crashes if called
        } as any;

        cgame = GetCGameAPI(mockImport);
        cgame.Init();
    });

    it('should register cg_predict and cg_showmiss cvars on init', () => {
        expect(mockImport.Cvar_Get).toHaveBeenCalledWith('cg_predict', '1', 0);
        expect(mockImport.Cvar_Get).toHaveBeenCalledWith('cg_showmiss', '0', 0);
        expect(mockCvars['cg_predict']).toBeDefined();
        expect(mockCvars['cg_showmiss']).toBeDefined();
    });

    it('should skip Pmove calculation when cg_predict is 0', () => {
        // Disable prediction
        mockCvars['cg_predict'].value = 0;

        const pmove: PmoveInfo = {
            s: {
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                onGround: false,
                waterLevel: 0,
                // Add missing bounds needed by checkWater
                mins: { x: -16, y: -16, z: -24 },
                maxs: { x: 16, y: 16, z: 32 },
                viewAngles: { x: 0, y: 0, z: 0 }
            } as any,
            cmd: {
                forwardmove: 100
            } as any
        };

        // Call Pmove
        cgame.Pmove(pmove);

        // Expect NO calls to PM_Trace (meaning physics was skipped)
        expect(mockImport.PM_Trace).not.toHaveBeenCalled();

        // Origin should be unchanged
        expect(pmove.s.origin.x).toBe(0);
    });

    it('should execute Pmove calculation when cg_predict is 1', () => {
        // Enable prediction
        mockCvars['cg_predict'].value = 1;

        const pmove: PmoveInfo = {
            s: {
                origin: { x: 0, y: 0, z: 0 },
                velocity: { x: 0, y: 0, z: 0 },
                onGround: false,
                waterLevel: 0,
                // Add missing bounds needed by checkWater
                mins: { x: -16, y: -16, z: -24 },
                maxs: { x: 16, y: 16, z: 32 },
                viewAngles: { x: 0, y: 0, z: 0 }
            } as any,
            cmd: {
                forwardmove: 100,
                sidemove: 0,
                upmove: 0,
                buttons: 0,
                angles: { x: 0, y: 0, z: 0 },
                msec: 100
            } as any
        };

        // Call Pmove
        cgame.Pmove(pmove);

        // Expect calls to PM_Trace (physics executed)
        expect(mockImport.PM_Trace).toHaveBeenCalled();

        // Origin should change due to movement (mock trace returns fraction 1.0 -> full move)
        // Note: applyPmove uses the trace result endpos if fraction < 1 or simple integration.
        // Wait, applyPmove logic with mock traces.
        // With mock trace returning { endpos: { x: 1... } }, we expect origin to be updated to that or similar.
        // Or if trace returns fraction 1, it calculates endpos from velocity * time.
        // BUT `applyPmove` implementation in shared might rely on trace returning endpos correctly?
        // Let's check `applyPmove`. It calls `trace`.
        // `const traceResult = trace(origin, ...)`
        // `return { ... origin: traceResult.endpos }`
        // So the mock MUST return `endpos`.

        expect(pmove.s.origin.x).not.toBe(0);
    });
});
