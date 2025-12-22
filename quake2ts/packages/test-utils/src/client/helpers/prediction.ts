import { EntityState } from '@quake2ts/shared';
import { ClientState, createMockClientState } from '../mocks/state.js';
import { UserCommand } from '@quake2ts/shared';

// -- Interfaces --

export interface PredictionScenario {
  clientState: ClientState;
  snapshots: EntityState[][];
  lagMs: number;
}

export interface SmoothingAnalysis {
  smooth: boolean;
  maxError: number;
  averageError: number;
  jumps: number[];
}

// -- Helpers --

export const createPredictionTestScenario = (lagMs: number = 100): PredictionScenario => {
  // Create a base client state using the factory
  const clientState = createMockClientState({
    playerNum: 0,
    serverTime: 1000,
    getClientName: (num: number) => 'TestPlayer'
  });

  // Create some snapshot history
  const snapshots: EntityState[][] = [];
  for (let i = 0; i < 5; i++) {
    const frameEntities: EntityState[] = [
      {
        number: 1,
        origin: { x: i * 10, y: 0, z: 0 },
        angles: { x: 0, y: 0, z: 0 },
        oldOrigin: { x: (i - 1) * 10, y: 0, z: 0 },
        modelIndex: 0,
        modelIndex2: 0,
        modelIndex3: 0,
        modelIndex4: 0,
        frame: 0,
        skinNum: 0,
        effects: 0,
        renderfx: 0,
        solid: 0,
        sound: 0,
        event: 0
      }
    ];
    snapshots.push(frameEntities);
  }

  return {
    clientState,
    snapshots,
    lagMs
  };
};

export const simulateClientPrediction = (
  state: ClientState,
  input: UserCommand,
  deltaTime: number
): ClientState => {
  // This is a stub for simulating prediction
  // Real implementation would invoke PMove logic
  // For testing helpers, we might just update time
  return {
    ...state,
    serverTime: state.serverTime + deltaTime * 1000
  };
};

export const createInterpolationTestData = (
  startState: EntityState,
  endState: EntityState,
  steps: number = 10
): EntityState[] => {
  const result: EntityState[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lerp = (a: number, b: number) => a + (b - a) * t;

    result.push({
      ...startState,
      origin: {
        x: lerp(startState.origin.x, endState.origin.x),
        y: lerp(startState.origin.y, endState.origin.y),
        z: lerp(startState.origin.z, endState.origin.z),
      },
      angles: {
         x: lerp(startState.angles.x, endState.angles.x),
         y: lerp(startState.angles.y, endState.angles.y),
         z: lerp(startState.angles.z, endState.angles.z),
      }
    });
  }

  return result;
};

export const verifySmoothing = (states: EntityState[]): SmoothingAnalysis => {
  let maxError = 0;
  let totalError = 0;
  const jumps: number[] = [];

  for (let i = 1; i < states.length; i++) {
    const prev = states[i-1].origin;
    const curr = states[i].origin;

    const dx = curr.x - prev.x;
    const dy = curr.y - prev.y;
    const dz = curr.z - prev.z;
    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

    // Assume constant velocity, check for large deviations
    // Ideally we'd compare against expected position
    // Here we just track distance changes

    if (dist > 50) { // arbitrary jump threshold
        jumps.push(i);
    }

    totalError += dist; // This isn't really error without a reference, but serves as a metric
  }

  return {
    smooth: jumps.length === 0,
    maxError,
    averageError: totalError / (states.length - 1 || 1),
    jumps
  };
};
