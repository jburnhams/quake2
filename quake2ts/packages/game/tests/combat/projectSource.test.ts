import { describe, it, expect, vi, beforeEach } from 'vitest';
import { P_ProjectSource, getProjectileOrigin } from '../../src/combat/weapons/projectSource.js';
import { Entity } from '../../src/entities/entity.js';
import { GameExports } from '../../src/index.js';
import { Vec3 } from '@quake2ts/shared';

describe('P_ProjectSource', () => {
    let mockGame: GameExports;
    let mockPlayer: Entity;

    beforeEach(() => {
        mockGame = {
            trace: vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
        } as unknown as GameExports;

        mockPlayer = {
            origin: { x: 100, y: 100, z: 100 },
            viewheight: 22,
            angles: { x: 0, y: 0, z: 0 } // Facing East (X-axis)
        } as unknown as Entity;
    });

    it('calculates eye position correctly', () => {
        // Forward: 1, 0, 0
        // Right: 0, -1, 0 (Quake coords: Y is left) -> Wait.
        // angleVectors(0,0,0) -> Forward(1,0,0), Right(0,-1,0), Up(0,0,1)
        // Let's assume standard Quake coordinates:
        // Angle 0: East. Forward (1,0,0). Right (0,-1,0). Up (0,0,1).

        const offset = { x: 0, y: 0, z: 0 };
        const forward = { x: 1, y: 0, z: 0 };
        const right = { x: 0, y: -1, z: 0 };
        const up = { x: 0, y: 0, z: 1 };

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Result should be origin + viewheight
        expect(result).toEqual({ x: 100, y: 100, z: 122 });
    });

    it('applies offsets correctly', () => {
        // Forward(1,0,0), Right(0,-1,0), Up(0,0,1)
        // Offset {8, 8, 8}
        // Result = Eye + Forward*8 + Right*8 + Up*8
        // Eye = {100, 100, 122}
        // + {8, 0, 0}
        // + {0, -8, 0}
        // + {0, 0, 8}
        // = {108, 92, 130}

        const offset = { x: 8, y: 8, z: 8 };
        const forward = { x: 1, y: 0, z: 0 };
        const right = { x: 0, y: -1, z: 0 };
        const up = { x: 0, y: 0, z: 1 };

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        expect(result).toEqual({ x: 108, y: 92, z: 130 });
    });

    it('prevents shooting through walls', () => {
        // Trace hits halfway
        (mockGame.trace as any).mockReturnValue({
            fraction: 0.5,
            endpos: { x: 104, y: 96, z: 126 } // Hits a wall
        });

        const offset = { x: 8, y: 8, z: 8 };
        const forward = { x: 1, y: 0, z: 0 };
        const right = { x: 0, y: -1, z: 0 };
        const up = { x: 0, y: 0, z: 1 };

        const result = P_ProjectSource(mockGame, mockPlayer, offset, forward, right, up);

        // Should return endpos - forward
        // {104, 96, 126} - {1, 0, 0} = {103, 96, 126}
        expect(result).toEqual({ x: 103, y: 96, z: 126 });
    });

    it('getProjectileOrigin uses angleVectors', () => {
        // Just verify it runs without crashing, assuming angleVectors works
        const result = getProjectileOrigin(mockGame, mockPlayer, { x: 10, y: 0, z: 0 });
        // Facing 0,0,0 -> Forward 1,0,0
        // Eye {100, 100, 122} + {10, 0, 0} = {110, 100, 122}
        expect(result.x).toBeCloseTo(110);
        expect(result.y).toBeCloseTo(100);
        expect(result.z).toBeCloseTo(122);
    });
});
