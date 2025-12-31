import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientPrediction, defaultPredictionState, PredictionState } from '../../src/prediction/index';
import type { UserCommand, PmoveTraceFn } from '@quake2ts/shared';
import type { GameFrameResult } from '@quake2ts/engine';

describe('ClientPrediction Error Smoothing', () => {
  let prediction: ClientPrediction;
  const mockTrace: PmoveTraceFn = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } });
  const mockPointContents = vi.fn().mockReturnValue(0);
  const settings = {
    pmFriction: 6,
    pmStopSpeed: 100,
    pmAccelerate: 10,
    pmAirAccelerate: 1,
    pmWaterAccelerate: 4,
    pmWaterFriction: 1,
    pmMaxSpeed: 300,
    pmDuckSpeed: 100,
    pmWaterSpeed: 400,
    groundIsSlick: false,
  };

  beforeEach(() => {
    mockTrace.mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 } });
    mockPointContents.mockReturnValue(0);
    prediction = new ClientPrediction({ trace: mockTrace, pointContents: mockPointContents }, settings);
  });

  const createCommand = (sequence: number): UserCommand => ({
    msec: 10,
    angles: { x: 0, y: 0, z: 0 },
    buttons: 0,
    forwardmove: 100,
    sidemove: 0,
    upmove: 0,
    impulse: 0,
    lightlevel: 0,
    sequence: sequence,
  });

  it('should calculate prediction error when server state differs slightly', () => {
    // 1. Predict a frame
    prediction.enqueueCommand(createCommand(1));
    const predictedState = prediction.getPredictedState();

    // 2. Server response for frame 1 with SMALL deviation (e.g., 5 units)
    const serverState: PredictionState = {
        ...predictedState,
        origin: { x: predictedState.origin.x - 5, y: predictedState.origin.y, z: predictedState.origin.z }
    };
    const serverFrame: GameFrameResult<PredictionState> = {
        frame: 1,
        timeMs: 10,
        state: serverState
    };

    prediction.setAuthoritative(serverFrame);

    // Error = Predicted - Server = (X) - (X-5) = 5
    const error = prediction.getPredictionError();
    expect(error.x).toBeCloseTo(5);
  });

  it('should snap (reset error) when server state differs significantly (> 10)', () => {
    // 1. Predict
    prediction.enqueueCommand(createCommand(1));
    const predictedState = prediction.getPredictedState();

    // 2. Server response for frame 1 with LARGE deviation (e.g., 20 units)
    const serverState: PredictionState = {
        ...predictedState,
        origin: { x: predictedState.origin.x - 20, y: predictedState.origin.y, z: predictedState.origin.z }
    };
    const serverFrame: GameFrameResult<PredictionState> = {
        frame: 1,
        timeMs: 10,
        state: serverState
    };

    prediction.setAuthoritative(serverFrame);

    // Should snap, so error should be 0
    const error = prediction.getPredictionError();
    expect(error.x).toBe(0);
  });

  it('should decay error over time', () => {
      // Setup initial error
      (prediction as any).predictionError = { x: 10, y: 0, z: 0 };

      // Decay over 50ms (0.05s)
      // Decay speed is len * 10 * frametime = 10 * 10 * 0.05 = 5.
      // New error = 10 - 5 = 5.
      prediction.decayError(0.05);

      const error = prediction.getPredictionError();
      expect(error.x).toBeCloseTo(5);

      // Decay again
      prediction.decayError(0.05);
      expect(prediction.getPredictionError().x).toBeCloseTo(2.5); // Decay is proportional to length? No, logic was len - decay.

      // Wait, logic:
      // const decay = len * 10 * frametime;
      // scale = (len - decay) / len
      // new = old * scale

      // First step: len=10. decay = 10 * 10 * 0.05 = 5. scale = (10-5)/10 = 0.5. Result = 5.
      // Second step: len=5. decay = 5 * 10 * 0.05 = 2.5. scale = (5-2.5)/5 = 0.5. Result = 2.5.
      // Matches.
  });
});
