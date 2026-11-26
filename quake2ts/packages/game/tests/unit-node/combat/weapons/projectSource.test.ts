import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P_ProjectSource, P_ProjectShot, getProjectileOrigin } from '../../../../src/combat/weapons/projectSource.js';
import { Entity } from '../../../../src/entities/entity.js';
import { GameExports } from '../../../../src/index.js';
import { Vec3, angleVectors, addVec3, scaleVec3, CONTENTS_MONSTER } from '@quake2ts/shared';
import { createEntityFactory, createMockGameExports, createTraceMock } from '@quake2ts/test-utils';

describe('P_ProjectSource', () => {
    let mockGame: GameExports;
    let mockPlayer: Entity;

    beforeEach(() => {
        mockGame = createMockGameExports({
             trace: vi.fn(),
        });

        mockPlayer = createEntityFactory({
            origin: { x: 100, y: 100, z: 100 },
            viewheight: 22,
            angles: { x: 0, y: 0, z: 0 } // Facing East (1, 0, 0)
        }) as Entity;
    });

    it('should calculate correct muzzle position without obstruction', () => {
        // Mock trace to return fraction 1.0 (no hit)
        (mockGame.trace as any).mockReturnValue(createTraceMock({
            fraction: 1.0,
            endpos: { x: 0, y: 0, z: 0 } // irrelevant when fraction is 1.0
        }));

        const offset: Vec3 = { x: 8, y: 8, z: -8 };
        // Forward: 1, 0, 0
        // Right: 0, -1, 0
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

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
        (mockGame.trace as any).mockReturnValue(createTraceMock({
            fraction: 0.5, // Hit halfway
            endpos: { x: 110, y: 100, z: 122 }
        }));

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
        (mockGame.trace as any).mockReturnValue(createTraceMock({ fraction: 1.0 }));

        const result = getProjectileOrigin(mockGame, mockPlayer);

        // Default offset depends on implementation, but likely { x: 8, y: 8, z: 8 } based on logic or usage
        // But checking `projectSource.ts` implementation details (if we could) or deducing from test expectation.
        // Previous test expected {108, 92, 130} => {8, 8, 8} offsets.
        // x: 100 + 8 = 108
        // y: 100 - 8 = 92
        // z: 122 + 8 = 130

        expect(result.x).toBeCloseTo(108);
        expect(result.y).toBeCloseTo(92);
        expect(result.z).toBeCloseTo(130);
    });

    it('should adjust origin based on viewheight (ducking)', () => {
        // Default mockPlayer has viewheight 22.
        // Let's modify it.
        mockPlayer.viewheight = 10;

        (mockGame.trace as any).mockReturnValue(createTraceMock({ fraction: 1.0 }));

        const offset: Vec3 = { x: 0, y: 0, z: 0 };
        const { forward, right, up } = angleVectors({ x: 0, y: 0, z: 0 });

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Expected EyePos: 100, 100, 100 + 10 = 110
        expect(result.z).toBeCloseTo(110);
    });
});

describe('P_ProjectShot (the rerelease P_ProjectSource)', () => {
    const player = () => createEntityFactory({ origin: { x: 0, y: 0, z: 0 }, viewheight: 22, angles: { x: 0, y: 0, z: 0 } }) as Entity;
    const eye = { x: 0, y: 0, z: 22 };

    it.each([[-45], [0], [45]])('aims from the gun at the point under the crosshair (pitch %i)', (pitch) => {
        const angles = { x: pitch, y: 30, z: 0 };
        const { forward } = angleVectors(angles);
        // The crosshair trace stops 400 units out; the muzzle check is clear.
        const trace = vi.fn((start: Vec3, _mins: unknown, _maxs: unknown, end: Vec3) => {
            const len = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
            return len > 1000 ? createTraceMock({ fraction: 400 / 8192, endpos: addVec3(eye, scaleVec3(forward, 400)) }) : createTraceMock({ fraction: 1, endpos: end });
        });
        const game = createMockGameExports({ trace }) as GameExports;
        const shot = P_ProjectShot(game, player(), angles, { x: 8, y: 8, z: -8 });
        const aim = addVec3(eye, scaleVec3(forward, 400));
        const t = (aim.x - shot.start.x) / shot.dir.x;
        expect(shot.start.x + shot.dir.x * t).toBeCloseTo(aim.x, 3);
        expect(shot.start.y + shot.dir.y * t).toBeCloseTo(aim.y, 3);
        expect(shot.start.z + shot.dir.z * t).toBeCloseTo(aim.z, 3);
        expect(Math.hypot(shot.dir.x, shot.dir.y, shot.dir.z)).toBeCloseTo(1, 5);
    });

    it('flies straight along the view at a monster under 128 units away', () => {
        const angles = { x: 30, y: 0, z: 0 };
        const trace = vi.fn(() => createTraceMock({ fraction: 64 / 8192, contents: CONTENTS_MONSTER, endpos: { x: 0, y: 0, z: 0 } }));
        const game = createMockGameExports({ trace }) as GameExports;
        const shot = P_ProjectShot(game, player(), angles, { x: 8, y: 8, z: -8 });
        expect(shot.dir).toEqual(angleVectors(angles).forward);
    });
});

