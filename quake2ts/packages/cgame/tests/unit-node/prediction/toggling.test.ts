import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientPrediction, PredictionSettings, PredictionState, defaultPredictionState } from '../../../src/index';
import { PmoveTraceFn, UserCommand, PmFlag, PmType, WaterLevel } from '@quake2ts/shared';

describe('ClientPrediction Toggling', () => {
    let prediction: ClientPrediction;
    let traceFn: PmoveTraceFn;
    let pointContentsFn: any;

    const DEFAULT_STATE = defaultPredictionState();

    beforeEach(() => {
        traceFn = vi.fn().mockReturnValue({
            fraction: 1.0,
            endpos: { x: 0, y: 0, z: 0 },
            plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 },
            surface: { name: 'ground', flags: 0, value: 0 },
            ent: -1,
            contents: 0,
            allsolid: false,
            startsolid: false
        });
        pointContentsFn = vi.fn().mockReturnValue(0);
        prediction = new ClientPrediction({ trace: traceFn, pointContents: pointContentsFn });
    });

    it('should respect setPredictionEnabled(false)', () => {
        prediction.setPredictionEnabled(false);

        // Set authoritative state
        const state: PredictionState = { ...DEFAULT_STATE, origin: { x: 100, y: 0, z: 0 } };
        prediction.setAuthoritative({ frame: 1, timeMs: 100, state });

        // Enqueue a command that would normally move the player
        const cmd: UserCommand = {
            sequence: 2,
            angles: { x: 0, y: 0, z: 0 },
            forwardmove: 100,
            sidemove: 0,
            upmove: 0,
            buttons: 0,
            impulse: 0,
            lightlevel: 0,
            msec: 100
        };

        const result = prediction.enqueueCommand(cmd);

        // Should return authoritative state, no simulation
        expect(result.origin.x).toEqual(100);
        // Simulation trace should NOT be called
        expect(traceFn).not.toHaveBeenCalled();
    });

    it('should resume prediction when re-enabled', () => {
        prediction.setPredictionEnabled(false);
        const state: PredictionState = { ...DEFAULT_STATE, origin: { x: 100, y: 0, z: 0 } };
        prediction.setAuthoritative({ frame: 1, timeMs: 100, state });

        prediction.setPredictionEnabled(true);

        const cmd: UserCommand = {
            sequence: 2,
            angles: { x: 0, y: 0, z: 0 },
            forwardmove: 400, // Should move significantly
            sidemove: 0,
            upmove: 0,
            buttons: 0,
            impulse: 0,
            lightlevel: 0,
            msec: 100
        };

        const result = prediction.enqueueCommand(cmd);

        // Should simulate now
        // With move 400 * 0.1s = 40 units? (Assuming friction/accel allow)
        // Actually traceFn mock returns fraction 1.0 so it moves freely.
        // We just check traceFn was called.
        expect(traceFn).toHaveBeenCalled();
        expect(result.origin.x).not.toEqual(100);
    });

    it('should reset prediction error when disabled', () => {
        // Setup a scenario with prediction error
        const state: PredictionState = { ...DEFAULT_STATE, origin: { x: 100, y: 0, z: 0 } };
        prediction.setAuthoritative({ frame: 1, timeMs: 100, state });

        // Simulate a move
        const cmd: UserCommand = {
            sequence: 2,
            angles: { x: 0, y: 0, z: 0 },
            forwardmove: 100,
            sidemove: 0,
            upmove: 0,
            buttons: 0,
            impulse: 0,
            lightlevel: 0,
            msec: 100
        };
        prediction.enqueueCommand(cmd);

        // Now receive authoritative update that differs (server says we didn't move)
        const state2: PredictionState = { ...DEFAULT_STATE, origin: { x: 100, y: 0, z: 0 } };

        // This calculates error
        prediction.setAuthoritative({ frame: 2, timeMs: 200, state: state2 });

        // We predicted moving, server said staying. Error should be present.
        // (Assuming simulation moved us).

        // Now disable prediction
        prediction.setPredictionEnabled(false);

        // Next update
        prediction.setAuthoritative({ frame: 3, timeMs: 300, state: state2 });

        const error = prediction.getPredictionError();
        expect(error.x).toBe(0);
        expect(error.y).toBe(0);
        expect(error.z).toBe(0);
    });
});
