# WebGL Testing Strategy

## Overview
This document outlines the approach for testing WebGL-dependent code in the Quake2 TypeScript engine, considering the constraints of the build environment.

## Constraints
- Cannot install heavy system libraries (like native OpenGL) in CI/CD build environments
- Need realistic testing, not just mocks
- Must work in both browser and Node.js environments

## Solutions

### 1. Pure Math Tests (Current Approach)
For camera, matrix, and vector operations that don't require actual GPU rendering:
- **Library**: `gl-matrix` (no WebGL required)
- **Environment**: Node.js with jsdom
- **Pros**: Fast, lightweight, no system dependencies
- **Cons**: Doesn't test actual WebGL API calls

**Use for**: Camera matrices, transformations, frustum culling math, etc.

### 2. headless-gl (Attempted - Not Viable)
Provides real WebGL context in Node.js.
- **Status**: Added to project but requires native OpenGL libraries
- **Issue**: Needs `libGL.so`, `libGLX.so` which aren't available in minimal build environments
- **Recommendation**: Keep as optional dev dependency, document requirements

**System Requirements** (if using):
```bash
# Ubuntu/Debian
sudo apt-get install -y libxi-dev libglu1-mesa-dev libglew-dev pkg-config

# Set environment variable for software rendering (if no GPU)
export LIBGL_ALWAYS_SOFTWARE=1
```

### 3. Browser-Based Testing (Recommended for Integration Tests)
For tests that actually need WebGL rendering:

#### Option A: @vitest/browser
```bash
pnpm add -D @vitest/browser playwright
```

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
    },
  },
});
```

**Pros**:
- Real WebGL context
- Tests actual browser behavior
- No system library dependencies

**Cons**:
- Slower than unit tests
- Requires browser automation

#### Option B: Playwright Component Testing
Use Playwright to test WebGL components in isolation.

**Pros**:
- Real browser environment
- Can capture screenshots for visual regression
- Good for integration tests

**Cons**:
- More complex setup
- Slower execution

### 4. Mock-Based Testing (For Unit Tests)
For testing WebGL API interactions without actual rendering:

```typescript
// Create a WebGL mock
const mockGL = {
  createBuffer: vi.fn(() => ({})),
  bindBuffer: vi.fn(),
  bufferData: vi.fn(),
  // ... other methods
};
```

**Pros**:
- Fast
- No dependencies
- Good for testing error handling and API usage

**Cons**:
- Doesn't catch rendering bugs
- Requires maintaining mocks

## Recommended Testing Strategy

### Unit Tests (Node.js + gl-matrix)
```typescript
// tests/render/camera.test.ts
describe('Camera', () => {
  it('should calculate view matrices correctly', () => {
    const camera = new Camera();
    camera.position = vec3.fromValues(0, 0, 0);
    camera.angles = vec3.fromValues(0, 0, 0);

    const viewMatrix = camera.viewMatrix;
    // Assert matrix values
  });
});
```

### Integration Tests (Browser-based)
```typescript
// tests/integration/rendering.test.ts
describe('WebGL Rendering', () => {
  it('should render a frame', async () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');

    const renderer = new Renderer(gl);
    renderer.renderFrame();

    // Verify no GL errors
    expect(gl.getError()).toBe(gl.NO_ERROR);
  });
});
```

### Visual Regression Tests (Optional)
Use Playwright to capture and compare screenshots of rendered frames.

## Current Implementation

### Fixed Issues
1. ✅ Added `DEG2RAD` and `RAD2DEG` exports to `@quake2ts/shared/math/angles.ts`
2. ✅ Added headless-gl as dev dependency (optional, requires system libraries)
3. ✅ Configured vitest setup for WebGL context creation (falls back gracefully)

### Remaining Issues
1. ⚠️  Camera coordinate transformation matrix doesn't match expected values
   - Tests expect one transformation matrix
   - Implementation uses a different matrix
   - Need to verify against original Quake2 code

## Next Steps

1. **For Camera Tests**: Fix the coordinate transformation matrix to match expected values
2. **For WebGL Tests**:
   - Set up @vitest/browser for integration tests
   - Keep unit tests using gl-matrix (no WebGL needed)
3. **For CI/CD**:
   - Use Playwright/browser tests in CI (GitHub Actions supports this)
   - Unit tests run without system dependencies

## Example CI Configuration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: pnpm test # Unit tests (no WebGL)

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v3
      - run: pnpm install
      - run: npx playwright install --with-deps
      - run: pnpm test:integration # Browser-based tests
```

## Conclusion

- **headless-gl**: Added to project but not viable for builds without system libraries
- **Recommendation**: Use gl-matrix for math tests, @vitest/browser for WebGL integration tests
- **Current Status**: Math library works, camera transformation needs fixing
