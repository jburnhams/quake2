# WebGL Visual Tests

This directory contains visual regression tests for the WebGL renderer.

## Prerequisites

These tests require the `gl` package (headless-gl) to provide a WebGL context in Node.js.
Because `gl` is a native module with system dependencies (like X11 and OpenGL headers on Linux), it is listed as an **optional dependency** in `@quake2ts/test-utils`.

### Installing `gl`

If you want to run these tests locally, you may need to install system dependencies first:

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install -y build-essential libxi-dev libglu1-mesa-dev libglew-dev pkg-config
```

**macOS / Windows:**
Usually works out of the box or requires standard build tools (Xcode / Visual Studio).

Then, ensure `gl` is installed:
```bash
pnpm install
```
(If it failed during initial install due to missing deps, try rebuilding or reinstalling after installing system deps).

## Running Tests

To run the WebGL visual tests:

```bash
pnpm test:webgl
```

This command runs `vitest` with `TEST_TYPE=webgl`, which enables the WebGL-specific test files and ensures they run in a compatible environment.

## Test Structure

Tests are organized by feature:
- `headless-webgl.test.ts`: Infrastructure tests (context creation, readback).
- (Future): Specific rendering feature tests.

## Troubleshooting

- **Module did not self-register / dlopen failed**: This usually means the `gl` binary was compiled against a different Node.js version or is missing system libraries. Try `pnpm rebuild gl` or remove `node_modules` and reinstall.
- **Context creation failed**: Ensure you have a valid display or use `xvfb-run` on Linux if you don't have a physical display (though `headless-gl` can often work without X via OSMesa if configured, strictly it often relies on X11 on Linux).
