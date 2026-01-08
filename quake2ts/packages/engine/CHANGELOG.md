# Changelog

All notable changes to the @quake2ts/engine package will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **BREAKING**: Renderer architecture refactored to use `CameraState` interface
  - All renderers now build their own view/projection matrices
  - Fixes WebGPU diagonal view coordinate bug
  - See [Section 22 documentation](../../docs/section-22-0.md) for details

### Added
- `CameraState` interface for renderer-agnostic camera data
- `Camera.toState()` method to extract CameraState from Camera
- `WebGLMatrixBuilder` and `WebGPUMatrixBuilder` utilities for renderer-specific matrix building
- Null and Logging renderers for testing and debugging
- Comprehensive visual regression test suite (70+ baselines across WebGPU and WebGL)
- Feature combination tests for camera angles, FOV, and aspect ratios

### Deprecated
- `Camera.viewMatrix` - use `toState()` with renderer-specific matrix builders instead
- `Camera.projectionMatrix` - use `toState()` with renderer-specific matrix builders instead
- `Camera.viewProjectionMatrix` - use `toState()` with renderer-specific matrix builders instead
- These methods remain for backward compatibility but will be removed in a future version

### Removed
- Feature flag `USE_NATIVE_COORDINATE_SYSTEM` (now always enabled)
- Legacy coordinate transformation code paths in WebGPU renderer

### Fixed
- WebGPU diagonal view rendering bug caused by double coordinate transformation
- Coordinate system consistency across all renderers
- Skybox rendering at arbitrary camera angles

---

## Migration Guide

### For Renderer Implementers

**Before (Legacy):**
```typescript
renderer.renderFrame({
  camera: camera,  // Renderer uses camera.viewMatrix, camera.projectionMatrix
  world: bspMap,
  sky: skybox
}, entities);
```

**After (Modern):**
```typescript
renderer.renderFrame({
  camera: camera,              // Keep for backward compatibility
  cameraState: camera.toState(), // Preferred - let renderer build matrices
  world: bspMap,
  sky: skybox
}, entities);
```

### For Game Code

No changes required - existing code continues to work. The `Camera` class now supports both legacy matrix access and modern `toState()` method.

