import { describe, expect, it } from 'vitest';
import {
  type UserCommand,
  type Vec3,
  PmFlag,
  PmType,
  WaterLevel
} from '@quake2ts/shared';
import { ClientPrediction, defaultPredictionState, PredictionState } from '../../src/prediction/index.js';
import { PmoveTraceResult } from '@quake2ts/shared';

const ZERO_VEC = { x: 0, y: 0, z: 0 } as const;

const mockTrace = (start: Vec3, end: Vec3) => {
  return {
    fraction: 1,
    endpos: end,
    allsolid: false,
    startsolid: false,
  } as PmoveTraceResult;
};

const mockPointContents = (point: Vec3) => 0;

function createGroundState(): PredictionState {
  return {
    ...defaultPredictionState(),
    origin: ZERO_VEC,
    velocity: { x: 0, y: 0, z: 0 },
    viewAngles: ZERO_VEC,
    pmFlags: PmFlag.OnGround,
    pmType: PmType.Normal,
    waterLevel: WaterLevel.None,
    gravity: 800,
    deltaAngles: ZERO_VEC,
  } as PredictionState;
}

describe('ClientPrediction Tolerance', () => {
    it('uses custom error tolerance for snapping', () => {
        // Create prediction with strict snap threshold (e.g. 5 units)
        const prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents }, {
            errorSnapThreshold: 5
        });

        // Set initial state
        const base = createGroundState();
        prediction.setAuthoritative({ frame: 1, timeMs: 25, state: base });

        // We need to enqueue a command so there IS a predicted state matching the next server frame.
        // setAuthoritative checks commands with sequence <= frame.frame.
        // We will receive frame 2. So we need command with sequence 2.
        const cmd: UserCommand = {
            msec: 25,
            buttons: 0,
            angles: base.viewAngles,
            forwardmove: 0,
            sidemove: 0,
            upmove: 0,
            serverFrame: 1,
            sequence: 2
        };
        // This will result in state roughly same as base (0,0,0)
        prediction.enqueueCommand(cmd);

        // Now set authoritative state that is different.
        // Say server says we are at (6,0,0).
        // Difference is 6 units.
        // Default snap is 10. So default would NOT snap (would accumulate error).
        // But we set snap threshold to 5. So it SHOULD snap (reset error to 0).

        const serverState = {
            ...base,
            origin: { x: 6, y: 0, z: 0 }
        };

        prediction.setAuthoritative({ frame: 2, timeMs: 50, state: serverState });

        // If snapped, error should be 0.
        // If not snapped, error would be predicted - server = 0 - 6 = -6.
        const error = prediction.getPredictionError();
        expect(error).toEqual(ZERO_VEC);
    });

    it('uses custom error tolerance for accumulation', () => {
         // Create prediction with high accumulation threshold (e.g. 2 units)
         // So small errors (like 1 unit) are IGNORED (error set to 0), whereas usually 0.1 triggers accumulation.
        const prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents }, {
            errorTolerance: 2
        });

        const base = createGroundState();
        prediction.setAuthoritative({ frame: 1, timeMs: 25, state: base });

        const cmd: UserCommand = {
            msec: 25,
            buttons: 0,
            angles: base.viewAngles,
            forwardmove: 0,
            sidemove: 0,
            upmove: 0,
            serverFrame: 1,
            sequence: 2
        };
        prediction.enqueueCommand(cmd);

        // Server says (1.5, 0, 0)
        // Error = 0 - 1.5 = -1.5. Length 1.5.
        // Default tolerance 0.1 would capture this error.
        // Our tolerance 2 should IGNORE it -> error reset to 0.

        const serverState = {
            ...base,
            origin: { x: 1.5, y: 0, z: 0 }
        };

        prediction.setAuthoritative({ frame: 2, timeMs: 50, state: serverState });

        const error = prediction.getPredictionError();
        expect(error).toEqual(ZERO_VEC);
    });

     it('accumulates error when between tolerance and snap threshold', () => {
         const prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents }, {
            errorTolerance: 0.1,
            errorSnapThreshold: 10
        });

        const base = createGroundState();
        prediction.setAuthoritative({ frame: 1, timeMs: 25, state: base });

        const cmd: UserCommand = {
            msec: 25,
            buttons: 0,
            angles: base.viewAngles,
            forwardmove: 0,
            sidemove: 0,
            upmove: 0,
            serverFrame: 1,
            sequence: 2
        };
        prediction.enqueueCommand(cmd);

        // Server says (5, 0, 0)
        // Error = -5.
        // > 0.1 and <= 10. Should accumulate.

        const serverState = {
            ...base,
            origin: { x: 5, y: 0, z: 0 }
        };

        prediction.setAuthoritative({ frame: 2, timeMs: 50, state: serverState });

        const error = prediction.getPredictionError();
        // predicted was (0,0,0). server is (5,0,0).
        // error = predicted - server = (-5, 0, 0).
        expect(error.x).toBeCloseTo(-5);
     });
});
