## Renderer Architecture (v2)

As of Section 22-1, renderers can consume camera data in two ways:

1. **Legacy:** `options.camera.viewMatrix` (GL-space matrices)
2. **Modern:** `options.cameraState` (Quake-space data, build your own matrices)

New renderers should use `cameraState`. Legacy renderers will be migrated in future sections.
