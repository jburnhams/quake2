# Matrix Builders

Matrix builders convert `CameraState` (Quake-space) to renderer-specific matrices.

## WebGL (OpenGL)
- Uses right-handed coordinate system
- Depth range [-1, 1]
- Implementation matches legacy `Camera.updateMatrices` behavior with coordinate transformation
- See: `webgl.ts`

## WebGPU
- Uses left-handed coordinate system (after projection)
- Depth range [0, 1]
- **Critical:** Does NOT double-transform like legacy implementation
- Uses native WebGPU coordinates directly
- See: `webgpu.ts`

## Testing
- Identity builder preserves Quake coordinates
- Useful for debugging and logging
- See: `identity.ts`

## Coordinate Systems
See `../types/coordinates.ts` for formal definitions.

Quake Space:
- X: Forward
- Y: Left
- Z: Up
