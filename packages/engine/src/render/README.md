# Renderer Architecture

## Overview
Renderers consume `CameraState` (Quake-space data) and build their own view/projection matrices using renderer-specific conventions.

## CameraState Interface
```typescript
interface CameraState {
  readonly position: ReadonlyVec3;  // Quake coordinates (X forward, Y left, Z up)
  readonly angles: ReadonlyVec3;    // [pitch, yaw, roll] in degrees
  readonly fov: number;              // Field of view in degrees
  readonly aspect: number;           // Aspect ratio (width / height)
  readonly near: number;             // Near clipping plane
  readonly far: number;              // Far clipping plane
}
```

## Matrix Builders
- `WebGLMatrixBuilder` - OpenGL conventions (right-handed, Z-back)
- `WebGPUMatrixBuilder` - WebGPU conventions (left-handed, Z-forward)
- `IdentityMatrixBuilder` - Quake-space (testing/debugging)

## Renderers
- **WebGL**: Uses `WebGLMatrixBuilder` for native OpenGL coordinate system
- **WebGPU**: Uses `WebGPUMatrixBuilder` for native WebGPU coordinate system
- **Null**: No-op testing renderer
- **Logging**: Human-readable command log for debugging

## Usage

### Getting Camera State
```typescript
const camera = new Camera(width, height);
camera.setPosition(x, y, z);
camera.setRotation(pitch, yaw, roll);

const cameraState = camera.toState();
```

### Using in Renderer
```typescript
renderer.renderFrame({
  camera: camera,             // Legacy (for backward compatibility)
  cameraState: camera.toState(), // Modern (preferred)
  world: bspMap,
  sky: skybox
}, entities);
```

## Migration Complete

Section 22 refactoring completed 2026-01-08.
- All renderers use CameraState interface
- No more GL-specific assumptions in shared code
- Clean boundary enables future renderers (raytracing, Vulkan, etc.)
- Fixes WebGPU diagonal view coordinate bug

### Deprecated APIs
- `Camera.viewMatrix` - Use `toState()` with matrix builders
- `Camera.projectionMatrix` - Use `toState()` with matrix builders
- `Camera.viewProjectionMatrix` - Use `toState()` with matrix builders

These methods remain for backward compatibility but will be removed in a future version.

## Coordinate Systems

### Quake (Game Engine)
- +X: Forward
- +Y: Left
- +Z: Up
- Right-handed

### OpenGL/WebGL
- +X: Right
- +Y: Up
- +Z: Back (toward camera)
- Right-handed
- NDC: [-1, 1] for X, Y, Z

### WebGPU
- +X: Right
- +Y: Up
- +Z: Forward (away from camera)
- Left-handed
- NDC: [-1, 1] for X, Y; [0, 1] for Z
