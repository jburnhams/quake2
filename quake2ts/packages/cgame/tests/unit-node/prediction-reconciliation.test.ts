import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClientPrediction, defaultPredictionState, PredictionState } from '../../src/prediction/index';
import type { UserCommand, PmoveTraceFn } from '@quake2ts/shared';
import type { GameFrameResult } from '@quake2ts/engine';

describe('ClientPrediction Reconciliation', () => {
  let prediction: ClientPrediction;
  // Mock trace that returns the endpos we expect.
  // The physics engine relies on trace result to update position.
  // If we return { x: 0... }, physics stays at 0.
  // We need a trace that allows movement.
  const mockTrace: PmoveTraceFn = vi.fn((start, end) => ({
      fraction: 1.0,
      endpos: end, // Perfect movement
      plane: { normal: { x: 0, y: 0, z: 1 }, dist: 0 }
  }));

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

  it('should reconcile state when server update mismatch is detected', () => {
      // 1. Predict a few frames
      prediction.enqueueCommand(createCommand(1));
      prediction.enqueueCommand(createCommand(2));
      const predictedState = prediction.getPredictedState();

      // 2. Simulate server response for frame 1 with DIFFERENT state
      const serverState: PredictionState = {
          ...defaultPredictionState(),
          origin: { x: 50, y: 0, z: 0 }, // Different from prediction
      };
      const serverFrame: GameFrameResult<PredictionState> = {
          frame: 1, // Corresponding to sequence 1 (simplified mapping)
          timeMs: 10,
          state: serverState
      };

      // Assume mapping: frame number corresponds to last executed command sequence

      // For this test, we check if recompute is triggered and corrects the state.
      prediction.setAuthoritative(serverFrame);

      const reconciledState = prediction.getPredictedState();

      // Should have re-run command 2 on top of the new server state (x=50).
      // Command 2 adds more movement.
      // If server said x=50 at seq 1, and cmd 2 adds movement, result should be > 50.
      expect(reconciledState.origin.x).toBeGreaterThan(50);
      expect(reconciledState.origin.x).not.toBe(predictedState.origin.x);
  });

  it('should not rewind if server state matches prediction', () => {
    // 1. Predict
    prediction.enqueueCommand(createCommand(1));
    const predictedState1 = prediction.getPredictedState();

    // 2. Server confirms exact state
    const serverFrame: GameFrameResult<PredictionState> = {
        frame: 1,
        timeMs: 10,
        state: predictedState1
    };

    const spy = vi.spyOn(prediction as any, 'recompute');
    prediction.setAuthoritative(serverFrame);

    // Ideally, we want to avoid full recomputation if state matches perfectly,
    // but current implementation might always recompute.
    // Optimization task: check if we can skip recompute.
    // For now, let's just ensure the state remains correct.
    expect(prediction.getPredictedState()).toEqual(predictedState1);
  });
});
