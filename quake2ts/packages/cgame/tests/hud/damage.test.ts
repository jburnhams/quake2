
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Draw_Damage, Init_Damage } from '../../src/hud/damage';
import { CGameImport } from '../../src/types';
import { PlayerState, Vec3 } from '@quake2ts/shared';

describe('HUD Damage Indicators', () => {
    const mockCgi = {
        Draw_RegisterPic: vi.fn(),
        Draw_GetPicSize: vi.fn(),
        SCR_DrawColorPic: vi.fn(),
        Com_Print: vi.fn(),
    } as unknown as CGameImport;

    const width = 800;
    const height = 600;

    beforeEach(() => {
        vi.clearAllMocks();
        // Mock RegisterPic to return a dummy object
        (mockCgi.Draw_RegisterPic as any).mockImplementation((name: string) => ({ name }));
        // Mock GetPicSize to return some dimensions
        (mockCgi.Draw_GetPicSize as any).mockReturnValue({ width: 32, height: 32 });

        // Re-init damage pics to use the mock
        Init_Damage(mockCgi);
    });

    it('should not draw if no damage indicators', () => {
        const ps = {
            damageIndicators: [],
            damageAlpha: 0,
            viewAngles: { x: 0, y: 0, z: 0 } as Vec3
        } as unknown as PlayerState;

        Draw_Damage(mockCgi, ps, width, height);
        expect(mockCgi.SCR_DrawColorPic).not.toHaveBeenCalled();
    });

    it('should draw d_up when damage is from the front (0 relative angle for forward projection)', () => {
        // Player looking North (Yaw 90)
        // Damage from North (Forward)

        const ps = {
            damageIndicators: [{
                direction: { x: 0, y: 1, z: 0 },
                strength: 1.0
            }],
            damageAlpha: 0,
            viewAngles: { x: 0, y: 90, z: 0 } as Vec3
        } as unknown as PlayerState;

        Draw_Damage(mockCgi, ps, width, height);

        expect(mockCgi.SCR_DrawColorPic).toHaveBeenCalledTimes(1);
        const picArg = (mockCgi.SCR_DrawColorPic as any).mock.calls[0][2];
        expect(picArg).toEqual({ name: 'pics/d_up.pcx' });
    });

    it('should draw d_down when damage is from behind', () => {
        // Player looking North (Yaw 90)
        // Damage from South (Back)

        const ps = {
            damageIndicators: [{
                direction: { x: 0, y: -1, z: 0 },
                strength: 0.5
            }],
            damageAlpha: 0,
            viewAngles: { x: 0, y: 90, z: 0 } as Vec3
        } as unknown as PlayerState;

        Draw_Damage(mockCgi, ps, width, height);

        expect(mockCgi.SCR_DrawColorPic).toHaveBeenCalledTimes(1);
        const picArg = (mockCgi.SCR_DrawColorPic as any).mock.calls[0][2];
        expect(picArg).toEqual({ name: 'pics/d_down.pcx' });

        // Check alpha
        const alphaArg = (mockCgi.SCR_DrawColorPic as any).mock.calls[0][4];
        expect(alphaArg).toBe(0.5);
    });

    it('should draw d_left when damage is from left', () => {
        // Player looking North (Yaw 90)
        // Damage from West (Left)

        const ps = {
            damageIndicators: [{
                direction: { x: -1, y: 0, z: 0 },
                strength: 1.0
            }],
            damageAlpha: 0,
            viewAngles: { x: 0, y: 90, z: 0 } as Vec3
        } as unknown as PlayerState;

        Draw_Damage(mockCgi, ps, width, height);

        expect(mockCgi.SCR_DrawColorPic).toHaveBeenCalledTimes(1);
        const picArg = (mockCgi.SCR_DrawColorPic as any).mock.calls[0][2];
        expect(picArg).toEqual({ name: 'pics/d_left.pcx' });
    });

    it('should draw d_right when damage is from right', () => {
        // Player looking North (Yaw 90)
        // Damage from East (Right)

        const ps = {
            damageIndicators: [{
                direction: { x: 1, y: 0, z: 0 },
                strength: 1.0
            }],
            damageAlpha: 0,
            viewAngles: { x: 0, y: 90, z: 0 } as Vec3
        } as unknown as PlayerState;

        Draw_Damage(mockCgi, ps, width, height);

        expect(mockCgi.SCR_DrawColorPic).toHaveBeenCalledTimes(1);
        const picArg = (mockCgi.SCR_DrawColorPic as any).mock.calls[0][2];
        expect(picArg).toEqual({ name: 'pics/d_right.pcx' });
    });
});
