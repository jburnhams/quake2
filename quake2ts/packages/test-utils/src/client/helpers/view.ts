
import { vec3 } from 'gl-matrix';
import { Camera } from '@quake2ts/engine';
import { Vec3 } from '@quake2ts/shared';

// Define RefDef interface locally if it's not exported from shared/engine,
// or import it if we find it.
// Based on grep, RefDef seems elusive or I missed it.
// Standard Quake 2 RefDef:
export interface RefDef {
  x: number;
  y: number;
  width: number;
  height: number;
  fov_x: number;
  fov_y: number;
  vieworg: vec3;
  viewangles: vec3;
  time: number;
  rdflags: number;
  // ... other fields
}

export interface ViewState {
  camera: Camera;
  viewport: { x: number; y: number; width: number; height: number };
  refdef: RefDef;
}

export interface ViewScenario {
  viewState: ViewState;
  cleanup: () => void;
}

export interface CameraInput {
  forward?: number;
  right?: number;
  up?: number;
  pitchDelta?: number;
  yawDelta?: number;
  rollDelta?: number;
}

export interface DemoCameraResult {
  origin: Vec3;
  angles: Vec3;
  fov: number;
}

function toVec3(v: Vec3 | vec3 | { x: number, y: number, z: number } | number[]): vec3 {
  if (v instanceof Float32Array && v.length === 3) {
    return v as vec3;
  }
  if (Array.isArray(v) && v.length === 3) {
      return vec3.fromValues(v[0], v[1], v[2]);
  }
  if (typeof v === 'object' && 'x' in v && 'y' in v && 'z' in v) {
    return vec3.fromValues(v.x, v.y, v.z);
  }
  // Fallback or error? defaulting to 0,0,0
  return vec3.create();
}

/**
 * Creates a mock Camera instance with optional overrides.
 * Accepts partial Camera properties, where position/angles can be Vec3 objects or arrays.
 */
export function createMockCamera(overrides: Partial<Omit<Camera, 'position' | 'angles'> & { position: any, angles: any }> = {}): Camera {
  const camera = new Camera();

  if (overrides.position) {
    camera.position = toVec3(overrides.position);
  }
  if (overrides.angles) {
    camera.angles = toVec3(overrides.angles);
  }
  if (overrides.fov !== undefined) {
    camera.fov = overrides.fov;
  }
  // Apply other properties if exposed by Camera class setters

  return camera;
}

/**
 * Creates a mock Demo Camera state result (for getDemoCamera mock).
 * This returns a structure using Vec3 interface compatible with angleVectors, unlike Camera class.
 */
export function createMockDemoCameraResult(overrides: Partial<DemoCameraResult> = {}): DemoCameraResult {
    return {
        origin: overrides.origin || { x: 0, y: 0, z: 0 },
        angles: overrides.angles || { x: 0, y: 0, z: 0 },
        fov: overrides.fov ?? 90
    };
}

/**
 * Creates a mock RefDef object.
 */
export function createMockRefDef(overrides: Partial<RefDef> = {}): RefDef {
  return {
    x: 0,
    y: 0,
    width: 320,
    height: 240,
    fov_x: 90,
    fov_y: 90,
    vieworg: vec3.create(),
    viewangles: vec3.create(),
    time: 0,
    rdflags: 0,
    ...overrides
  };
}

/**
 * Creates a mock ViewState object.
 */
export function createMockViewState(overrides: Partial<ViewState> = {}): ViewState {
  return {
    camera: overrides.camera || createMockCamera(),
    viewport: overrides.viewport || { x: 0, y: 0, width: 800, height: 600 },
    refdef: overrides.refdef || createMockRefDef(),
    ...overrides
  };
}

/**
 * Creates a pre-configured view test scenario.
 */
export function createViewTestScenario(scenarioType: 'firstPerson' | 'thirdPerson' | 'spectator'): ViewScenario {
  const camera = createMockCamera();
  const refdef = createMockRefDef();

  switch (scenarioType) {
    case 'firstPerson':
      camera.position = vec3.fromValues(100, 100, 50);
      camera.angles = vec3.fromValues(0, 45, 0);
      vec3.copy(refdef.vieworg, camera.position);
      vec3.copy(refdef.viewangles, camera.angles);
      break;
    case 'thirdPerson':
      camera.position = vec3.fromValues(100, 100, 100); // Higher/back
      camera.angles = vec3.fromValues(30, 45, 0); // Looking down
      // Refdef might differ from camera in 3rd person (refdef usually is player eye, camera is offset)
      vec3.set(refdef.vieworg, 100, 100, 50); // Player origin
      break;
    case 'spectator':
      camera.position = vec3.fromValues(0, 0, 100);
      camera.angles = vec3.fromValues(90, 0, 0); // Top down
      break;
  }

  return {
    viewState: {
      camera,
      viewport: { x: 0, y: 0, width: 800, height: 600 },
      refdef
    },
    cleanup: () => {
      // Any cleanup if needed
    }
  };
}

/**
 * Simulates camera movement based on input delta.
 * This is a helper to verify camera logic, not a replacement for full physics.
 */
export function simulateCameraMovement(camera: Camera, input: CameraInput, deltaTime: number): Camera {
  // Simple movement simulation
  const speed = 100; // units per second

  // Update angles
  if (input.pitchDelta) camera.angles[0] += input.pitchDelta;
  if (input.yawDelta) camera.angles[1] += input.yawDelta;
  if (input.rollDelta) camera.angles[2] += input.rollDelta;

  // Force update dirty flag in Camera
  camera.angles = camera.angles;

  // Calculate forward/right/up vectors based on new angles
  // For simplicity, we can use simple trig or just assume standard axis aligned for basic tests
  // But proper way is AngleVectors.
  // Since we don't have AngleVectors imported here (it's in shared), we might skip complex relative movement
  // or import it.

  // Ideally: import { angleVectors } from '@quake2ts/shared/math/angles';
  // But we want to avoid deep deps if possible.

  // For now, let's just apply absolute movement if provided, or simplistic axis logic
  if (input.forward || input.right || input.up) {
      // simplistic impl
      camera.position[0] += (input.forward || 0) * deltaTime;
      camera.position[1] += (input.right || 0) * deltaTime;
      camera.position[2] += (input.up || 0) * deltaTime;
      camera.position = camera.position;
  }

  return camera;
}
