import { describe, it, expect, vi } from 'vitest';
import { trace } from '../src/physics/trace';
import { GameEngine } from '../src/index';
import { Vec3, TraceResult } from '@quake2ts/shared';

describe('trace', () => {
    it('should call the game engine trace function and return the result', () => {
        const mockTraceResult: TraceResult = {
            fraction: 0.5,
            endpos: { x: 5, y: 5, z: 5 },
            plane: null,
            surfaceFlags: 0,
            contents: 0,
            ent: null,
            allsolid: false,
            startsolid: false,
        };

        const mockGameEngine: GameEngine = {
            trace: vi.fn().mockReturnValue(mockTraceResult),
        };

        const start: Vec3 = { x: 0, y: 0, z: 0 };
        const end: Vec3 = { x: 10, y: 10, z: 10 };
        const mins: Vec3 = { x: 0, y: 0, z: 0 };
        const maxs: Vec3 = { x: 0, y: 0, z: 0 };
        const passent = null;
        const contentmask = 0;

        const result = trace(
            mockGameEngine,
            start,
            end,
            mins,
            maxs,
            passent,
            contentmask
        );

        expect(mockGameEngine.trace).toHaveBeenCalledWith(
            start,
            end,
            mins,
            maxs,
            passent,
            contentmask
        );
        expect(result).toEqual(mockTraceResult);
    });
});
