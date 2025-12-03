import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P_ProjectSource, getProjectileOrigin } from '../../../src/combat/weapons/projectSource.js';
import { Entity } from '../../../src/entities/entity.js';
import { GameExports } from '../../../src/index.js';
import { HAND_LEFT, HAND_CENTER } from '../../../src/inventory/playerInventory.js';
import { Vec3, angleVectors, addVec3, scaleVec3, copyVec3 } from '@quake2ts/shared';

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
            angles: { x: 0, y: 0, z: 0 }, // Facing East (1, 0, 0)
            client: {
                hand: 0 // Right handed default
            }
        } as unknown as Entity;
    });

    it('should calculate correct muzzle position without obstruction (Right Hand)', () => {
        // Mock trace for wall check (fraction 1.0)
        // Also mock trace for convergence check (fraction 1.0)
        // P_ProjectSource calls trace twice now.
        // 1. Convergence trace
        // 2. Wall check trace
        (mockGame.trace as any)
            .mockReturnValueOnce({ // Convergence trace
                fraction: 1.0,
                endpos: { x: 100 + 8192, y: 100, z: 122 },
                contents: 0,
                startsolid: false
            })
            .mockReturnValueOnce({ // Wall check trace
                fraction: 1.0,
                endpos: { x: 0, y: 0, z: 0 }
            });

        const offset: Vec3 = { x: 8, y: 8, z: -8 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Expected EyePos: 100, 100, 122
        // Offset X (Forward): 8 * (1, 0, 0) = (8, 0, 0)
        // Offset Y (Right): 8 * (0, -1, 0) = (0, -8, 0)
        // Offset Z (Up): -8 * (0, 0, 1) = (0, 0, -8)

        // Muzzle: 108, 92, 114

        expect(result.point.x).toBeCloseTo(108);
        expect(result.point.y).toBeCloseTo(92);
        expect(result.point.z).toBeCloseTo(114);

        // Convergence should be towards where eye is looking (8192 units forward)
        // Target: 100 + 8192, 100, 122 = 8292, 100, 122
        // Muzzle: 108, 92, 114
        // Vector: 8184, 8, 8
        // Normalized: (roughly (1, 0, 0))
        expect(result.dir.x).toBeCloseTo(1.0, 1); // rough check
    });

    it('should handle Left Handedness', () => {
        mockPlayer.client!.hand = HAND_LEFT;

        (mockGame.trace as any)
            .mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 });

        const offset: Vec3 = { x: 8, y: 8, z: -8 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Offset Y should be negated (multiplied by -1 in logic, but wait,
        // distance.y *= -1.
        // Original Right offset: 8.
        // Left Hand: -8.
        // Right Vector is (0, -1, 0).
        // Offset Y contribution: -8 * (0, -1, 0) = (0, 8, 0).

        // Muzzle: 100 + 8 + 0, 100 + 0 + 8, 122 - 8 = 108, 108, 114

        expect(result.point.x).toBeCloseTo(108);
        expect(result.point.y).toBeCloseTo(108); // 100 + 8
        expect(result.point.z).toBeCloseTo(114);
    });

    it('should handle Center Handedness', () => {
        mockPlayer.client!.hand = HAND_CENTER;

        (mockGame.trace as any)
            .mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 });

        const offset: Vec3 = { x: 8, y: 8, z: -8 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Offset Y should be 0.
        // Muzzle: 108, 100, 114

        expect(result.point.x).toBeCloseTo(108);
        expect(result.point.y).toBeCloseTo(100);
        expect(result.point.z).toBeCloseTo(114);
    });

    it('should pull back position if obstructed by wall', () => {
        const offset: Vec3 = { x: 20, y: 0, z: 0 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        // Expected EyePos: 100, 100, 122
        // Target Muzzle: 120, 100, 122

        (mockGame.trace as any)
            .mockReturnValueOnce({ fraction: 1.0, endpos: { x: 2000, y: 100, z: 122 }, contents: 0 }) // Convergence
            .mockReturnValueOnce({ // Wall check trace
                fraction: 0.5,
                endpos: { x: 110, y: 100, z: 122 }
            });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Should return endpos - 1 unit in forward direction
        // EndPos: 110, 100, 122
        // -1 * Forward: -1, 0, 0
        // Result: 109, 100, 122

        expect(result.point.x).toBeCloseTo(109);
        expect(result.point.y).toBeCloseTo(100);
        expect(result.point.z).toBeCloseTo(122);
    });

    it('should use raw forward direction if blocked by close monster', () => {
        const offset: Vec3 = { x: 8, y: 8, z: -8 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        // Mock trace hitting a monster very close
        (mockGame.trace as any)
            .mockReturnValueOnce({
                fraction: 0.01, // Very close
                endpos: { x: 105, y: 100, z: 122 },
                contents: 0x2000000 // CONTENTS_MONSTER (approx check, strictly should import const)
            })
            .mockReturnValueOnce({ fraction: 1.0 });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Should return raw forward vector as dir, not converged
        expect(result.dir).toEqual(forward);
    });

    it('getProjectileOrigin should return just the point', () => {
        (mockGame.trace as any).mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 });

        const result = getProjectileOrigin(mockGame, mockPlayer);

        expect(result.x).toBeDefined();
        expect(result.y).toBeDefined();
        expect(result.z).toBeDefined();
        expect((result as any).dir).toBeUndefined();
    });
});
