# Section 1: Asset Loading & Virtual Filesystem

## Overview
This section covers the complete asset ingestion pipeline for Quake II assets in the browser. It includes the virtual filesystem (VFS) backed by user-provided PAK files, and loaders for all asset formats: BSP (geometry, lightmaps, visibility), MD2/MD3 models, textures (WAL, PCX), and audio (WAV, OGG). The asset system must support async loading, caching, and deterministic index registration to match rerelease behavior.

## Dependencies
- **Shared package**: Requires BSP constants (`CONTENTS_*`, `SURF_*`) and protocol definitions (configstrings) - **COMPLETED**
- **Engine configstring registry**: Requires `ConfigStringRegistry` for deterministic `modelindex`/`soundindex`/`imageindex` - **COMPLETED**

## Work Already Done
- ✅ Shared BSP constants (`packages/shared/src/bsp/contents.ts`) with CONTENTS/SURF/MASK definitions
- ✅ ConfigString registry in engine (`packages/engine/src/configstrings.ts`) with deterministic indexing
- ✅ Protocol configstring ranges defined (`packages/shared/src/protocol/configstrings.ts`)
- ✅ BSP loader hardened with rerelease-style visibility/leaf bounds checks and precise lightmap slicing backed by new tests

## Tasks Remaining

### PAK & Virtual Filesystem
- [x] Implement PAK file format reader
  - Parse PAK header and directory entries
  - Support browser File/ArrayBuffer inputs
  - Validate checksums
- [x] Build VFS abstraction layer
  - Path-based file lookup (case-insensitive)
  - Directory enumeration for map/asset lists
  - Async read interface returning ArrayBuffer/typed arrays
- [x] Add browser file ingestion UX
  - File selector/drag-drop handlers via `wireFileInput`/`wireDropTarget`
  - Multi-PAK support (baseq2 + mods)
  - Progress reporting for large files (per-file callbacks)
  - Error handling for corrupted/invalid PAKs (non-fatal by default, optional abort)
  - **Helpers added**: programmatic `ingestPaks` pipeline with progress callbacks for File/Blob/ArrayBuffer sources and `ingestPakFiles` wrapper for browser `File` objects

### BSP Loader
- [x] Parse BSP header and lumps (entities, planes, vertices, nodes, texinfo, faces, lighting, leafs, leaffaces, edges, surfedges, models, brushes, brushsides, visibility)
- [x] Build spatial data structures
  - Node/leaf BSP tree for traversal
  - Face index lists per leaf
  - PVS (Potentially Visible Set) decompression
- [x] Extract and structure lightmap data
  - Per-face lightmap offsets and dimensions
  - Multi-style lightmaps for animated lighting
  - Store in format ready for GPU upload
- [x] Parse worldspawn entity for renderer settings (sky, fog, ambient light)
- [x] Build brush/hull geometry for collision system (see Section 3 dependency)

### Model Loaders (MD2/MD3)
- [x] MD2 loader
  - Parse header, frames, triangles, texture coordinates, GL commands
  - Build per-frame vertex/normal buffers
  - Support animation frame sequences
- [x] MD3 loader
  - Parse header, surfaces, frames, tags (attachment points)
  - Multi-surface models (head, torso, legs for player models)
  - Support tag-based hierarchical attachments
- [x] Model animation controller helpers
  - Frame interpolation between keyframes
  - Animation sequence definitions (idle, run, attack, death, etc.)

### Texture Loaders
- [x] WAL texture loader
  - Parse Quake II WAL format (mipmap levels, name, flags)
  - Extract base texture and mipmaps
  - Preserve surface flags (SURF_SKY, SURF_WARP, etc.)
- [x] PCX image loader
  - Parse PCX header and RLE-compressed data
  - Support palette-based and RGB formats
  - Used for textures, HUD graphics, skyboxes
- [x] Texture caching and GPU upload preparation
  - Convert to RGBA8 format for WebGL
  - Preserve mipmap chains
  - Handle special textures (warp, sky, transparent)

### Audio Loaders
- [x] WAV loader
  - Parse RIFF/WAV headers
  - Extract PCM audio data
  - Support various sample rates and bit depths
- [x] OGG Vorbis loader
  - Integrate OGG decoder library (e.g., vorbis.js or Web Audio native decode)
  - Async decoding for large files
  - Stream preparation for ambient sounds
- [x] Audio asset registry
  - Map sound indices to decoded audio buffers
  - Support for precache during level load
  - Reference counting for memory management

### Asset Caching & Management
- [x] Implement LRU cache for loaded assets
- [x] Optional IndexedDB persistence for PAK indexes
- [x] Asset validation (checksum verification against known PAK files)
- [x] Memory management and cleanup on level changes
- [x] Asset dependency tracking (ensure textures load before models that use them)

## Integration Points
- **To Rendering System (Section 2)**: Exposes loaded BSP geometry, lightmaps, model vertex data, and textures ready for GPU upload
- **To Physics System (Section 3)**: Provides BSP brush geometry, plane equations, and collision hull data
- **To Audio System (Section 7)**: Supplies decoded audio buffers keyed by sound index
- **To Entity System (Section 4)**: Provides model/sound lookup by index during entity spawn

## Testing Requirements

### Unit Tests (Standard)
- PAK directory parsing correctness
- BSP lump extraction and structure validation
- Model frame/vertex parsing accuracy
- Texture format conversion
- Audio buffer decoding

### Integration Tests
- **Full asset load pipeline**: Load a complete PAK, parse a BSP, resolve all texture/model/sound references
- **Multi-PAK resolution**: Ensure later PAKs override earlier ones (mod support)
- **Missing asset handling**: Graceful fallbacks when referenced assets don't exist
- **Large file streaming**: Test with full baseq2 PAK (~400MB) to ensure memory efficiency
- **Browser compatibility**: Test file loading on Chrome, Firefox, Safari
- **Error recovery**: Corrupted PAK files, truncated BSP data, invalid image formats

### Performance Tests
- Measure PAK index build time for large files
- BSP parsing and spatial structure build time
- Concurrent async loading of multiple assets
- Memory footprint of loaded assets
- Cache eviction behavior under memory pressure

## Notes
- All asset loaders must support async operation to avoid blocking the browser main thread
- BSP visibility data (PVS) is critical for rendering performance; ensure it's parsed and accessible
- Model animation data should be preprocessed into a format that's efficient for GPU skinning (if implementing GPU-based animation)
- Consider Web Workers for heavy parsing tasks (BSP, large model files)
- Texture and audio formats should be converted to WebGL/WebAudio-friendly formats during load
- PAK ingestion defaults to non-fatal validation; mismatches are reported while later PAKs continue mounting, and persisted
  PAK indexes remove all checksum variants for the same filename when cleared
- Validation recognizes the base rerelease install path (`baseq2/pak0.pak`) alongside plain filenames so strict validation
  does not reject canonical layouts
