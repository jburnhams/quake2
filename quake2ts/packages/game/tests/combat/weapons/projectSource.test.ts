import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P_ProjectSource, getProjectileOrigin } from '../../../src/combat/weapons/projectSource.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { Vec3, angleVectors, addVec3, scaleVec3 } from '@quake2ts/shared';

describe('P_ProjectSource', () => {
    let mockGame: GameExports;
    let mockPlayer: Entity;

    beforeEach(() => {
        mockGame = {
            trace: vi.fn(),
        } as unknown as GameExports;

        mockPlayer = {
            origin: { x: 100, y: 100, z: 100 },
            viewheight: 22,
            angles: { x: 0, y: 0, z: 0 } // Facing East (1, 0, 0)
        } as unknown as Entity;
    });

    it('should calculate correct muzzle position without obstruction', () => {
        // Mock trace to return fraction 1.0 (no hit)
        (mockGame.trace as any).mockReturnValue({
            fraction: 1.0,
            endpos: { x: 0, y: 0, z: 0 } // irrelevant when fraction is 1.0
        });

        const offset: Vec3 = { x: 8, y: 8, z: -8 };
        // Forward: 1, 0, 0
        // Right: 0, -1, 0 (Quake coordinates: Y is left/right? No.
        // angleVectors:
        // Forward (cos(y)*cos(p), sin(y)*cos(p), -sin(p))
        // Right (sin(y), -cos(y), 0) -> Actually angleVectors usually returns right vector.
        // Up ...

        // Let's use angleVectors to be sure what Forward/Right/Up are for 0,0,0
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });
        // forward: 1, 0, 0
        // right: 0, -1, 0  (Quake uses Right as Y axis inverted? Or strictly Right? Usually Y is left in Quake?)
        // In Quake: X=Forward, Y=Left, Z=Up.
        // angleVectors returns "Right" vector.
        // If Y is Left, Right is -Y. So 0, -1, 0.

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Expected EyePos: 100, 100, 122
        // Offset X (Forward): 8 * (1, 0, 0) = (8, 0, 0)
        // Offset Y (Right): 8 * (0, -1, 0) = (0, -8, 0)
        // Offset Z (Up): -8 * (0, 0, 1) = (0, 0, -8)

        // Muzzle: 108, 92, 114

        expect(result.x).toBeCloseTo(108);
        expect(result.y).toBeCloseTo(92);
        expect(result.z).toBeCloseTo(114);
    });

    it('should pull back position if obstructed by wall', () => {
        const offset: Vec3 = { x: 20, y: 0, z: 0 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        // Expected EyePos: 100, 100, 122
        // Target Muzzle: 120, 100, 122

        // Mock trace hitting a wall at x=110
        (mockGame.trace as any).mockReturnValue({
            fraction: 0.5, // Hit halfway
            endpos: { x: 110, y: 100, z: 122 }
        });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Should return endpos - 1 unit in forward direction
        // EndPos: 110, 100, 122
        // -1 * Forward: -1, 0, 0
        // Result: 109, 100, 122

        expect(result.x).toBeCloseTo(109);
        expect(result.y).toBeCloseTo(100);
        expect(result.z).toBeCloseTo(122);
    });

    it('getProjectileOrigin should use default offset if none provided', () => {
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0 });

        const result = getProjectileOrigin(mockGame, mockPlayer);

        // Default offset is 8, 8, 8 in implementation wrapper?
        // Wait, function signature says default is { x: 8, y: 8, z: 8 } in projectSource.ts
        // But in firing.ts usage we saw { x: 8, y: 8, z: -8 } ?
        // Let's check the default value in `projectSource.ts`.

        // EyePos: 100, 100, 122
        // Forward (8): +8x
        // Right (8): -8y
        // Up (8): +8z

        // Expected: 108, 92, 130

        expect(result.x).toBeCloseTo(108);
        expect(result.y).toBeCloseTo(92);
        expect(result.z).toBeCloseTo(130);
    });

    it('should adjust origin based on viewheight (ducking)', () => {
        // Standard viewheight is 22.
        // Let's test a different viewheight, e.g., 0 (crouching usually reduces it, but let's just show it uses the property)
        // Actually Quake 2 crouching viewheight is often lower.
        // If we change viewheight to 10, the Z should be lower.

        // Default mockPlayer has viewheight 22.
        // Let's modify it.
        mockPlayer.viewheight = 10;

        (mockGame.trace as any).mockReturnValue({ fraction: 1.0 });

        const offset: Vec3 = { x: 0, y: 0, z: 0 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Expected EyePos: 100, 100, 100 + 10 = 110
        expect(result.z).toBeCloseTo(110);
    });
});
