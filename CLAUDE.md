# Claude Development Notes

## WebGPU Headless Rendering Setup

### Overview
The quake2ts project uses WebGPU for rendering, including headless rendering for integration tests. This requires proper GPU drivers or software renderers.

### Quick Setup for Integration Tests

#### Linux (Ubuntu/Debian)
```bash
# 1. Configure apt to use proxy (if in Claude Code environment)
PROXY_URL="$http_proxy"
sudo bash -c "echo 'Acquire::http::Proxy \"$PROXY_URL\";' > /etc/apt/apt.conf.d/99proxy"

# 2. Install Mesa Vulkan drivers (includes lavapipe software renderer)
sudo apt-get install -y --no-install-recommends mesa-vulkan-drivers

# 3. Verify installation
ls /usr/share/vulkan/icd.d/
# Should see: lvp_icd.x86_64.json (lavapipe - CPU-based Vulkan)
```

#### macOS
No setup needed - Metal is built-in on macOS 10.11+

#### Windows
No setup needed - D3D12 is built-in on Windows 10+

### Running Integration Tests

```bash
cd quake2ts/packages/engine

# Unit tests (work without GPU)
pnpm test:unit tests/render/webgpu

# Integration tests (require GPU/Vulkan drivers)
pnpm test:integration tests/render/webgpu
```

### Package Dependencies

Already configured in `package.json`:
- `webgpu@^0.3.8` - Includes Dawn native bindings for Node.js
- `@webgpu/types@^0.1.68` - TypeScript definitions

The `webgpu` package automatically downloads platform-specific Dawn binaries during postinstall.

### Troubleshooting

**"No appropriate GPUAdapter found"**
- Linux: Install `mesa-vulkan-drivers`
- Ensure Vulkan ICD files exist in `/usr/share/vulkan/icd.d/`
- Check lavapipe is installed: `ls /usr/share/vulkan/icd.d/lvp_icd.x86_64.json`

**"Temporary failure resolving" during apt-get**
- Configure apt proxy: see step 1 above
- The `http_proxy` environment variable is set but apt doesn't use it automatically

**Tests crash after passing**
- Ensure devices are properly cleaned up in `afterAll` hooks
- Call `device.destroy()` on all created devices
- Add delay after cleanup: `await new Promise(resolve => setTimeout(resolve, 100))`

### Implementation Status

**Section 20-1: WebGPU Context & Device Management** ✅
- Core context creation: ✅
- Headless rendering support: ✅
- Unit tests (mocked): ✅ 10/10 passing
- Integration tests (real GPU): ✅ 2/2 passing

Files:
- `quake2ts/packages/engine/src/render/webgpu/context.ts`
- `quake2ts/packages/engine/src/render/webgpu/headless.ts`
- `quake2ts/packages/engine/src/render/interface.ts`
- `quake2ts/packages/test-utils/src/engine/mocks/webgpu.ts`

Tests:
- `quake2ts/packages/engine/tests/render/webgpu/context.test.ts`
- `quake2ts/packages/engine/tests/render/webgpu/headless.test.ts`
- `quake2ts/packages/engine/tests/render/webgpu/integration.test.ts`

### Next Steps
- Section 20-2: Core Resource Abstractions (buffers, textures, shaders)

### References
- WebGPU Spec: https://www.w3.org/TR/webgpu/
- Dawn (Google's WebGPU implementation): https://dawn.googlesource.com/dawn
- Lavapipe (Mesa software Vulkan): https://docs.mesa3d.org/drivers/lavapipe.html
