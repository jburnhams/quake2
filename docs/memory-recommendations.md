# Memory Budget Recommendations

This document outlines memory budget recommendations for different classes of devices running `quake2ts`. The engine provides mechanisms to enforce these budgets via the `AssetManager.enforceMemoryBudget` method.

## Device Classes

### Low-End (Mobile / Old Laptops)

Devices with limited RAM (<= 4GB) and restricted GPU memory.

*   **Total Heap Limit Recommendation**: 512MB
*   **Texture Memory Limit**: 64MB - 128MB
*   **Texture Cache Capacity**: 64 - 128 items
*   **Audio Cache Size**: 32 - 64 items (Use streaming where possible)
*   **Asset Loading**: Use aggressive LRU eviction.

### Mid-Range (Standard Laptops / Tablets)

Devices with moderate RAM (8GB) and integrated graphics.

*   **Total Heap Limit Recommendation**: 1GB
*   **Texture Memory Limit**: 256MB
*   **Texture Cache Capacity**: 256 items
*   **Audio Cache Size**: 128 items
*   **Asset Loading**: Balanced approach.

### High-End (Gaming PC / High-End Mobile)

Devices with abundant RAM (>= 16GB) and dedicated GPUs.

*   **Total Heap Limit Recommendation**: 2GB+
*   **Texture Memory Limit**: 512MB+ (or unlimited)
*   **Texture Cache Capacity**: 512+ items
*   **Audio Cache Size**: 256+ items
*   **Asset Loading**: Preload aggressively.

## Usage

```typescript
import { AssetManager, MemoryBudget } from '@quake2ts/engine';

const isMobile = /Mobi|Android/i.test(navigator.userAgent);
const isHighEnd = navigator.hardwareConcurrency > 8 && navigator.deviceMemory >= 8;

let budget: MemoryBudget;

if (isMobile) {
  budget = {
    textureMemoryLimit: 64 * 1024 * 1024, // 64 MB
    textureCacheCapacity: 64,
    audioCacheSize: 32
  };
} else if (isHighEnd) {
  budget = {
    textureMemoryLimit: 512 * 1024 * 1024, // 512 MB
    textureCacheCapacity: 512,
    audioCacheSize: 256
  };
} else {
  // Default / Mid-range
  budget = {
    textureMemoryLimit: 256 * 1024 * 1024, // 256 MB
    textureCacheCapacity: 256,
    audioCacheSize: 128
  };
}

game.engine.assets.enforceMemoryBudget(budget);
```

## Monitoring

Use `game.engine.assets.getMemoryUsage()` to monitor current usage against these limits.

*   `textures`: Bytes used by texture data in main memory (excluding GPU).
*   `audio`: Number of cached audio clips (approximate).
*   `heapUsed`: JavaScript heap usage (if available).

## Implementation Details

*   **Textures**: The engine uses an LRU cache for textures. When the memory limit or item capacity is reached, the least recently used textures are evicted. This may cause a slight pause if they need to be reloaded later.
*   **Audio**: Audio clips are decoded on demand or preloaded. The cache limits the number of decoded buffers kept in memory.
*   **Models**: MD2/MD3 models are currently cached by the `AssetManager` but do not yet have a strict byte-limit eviction policy in the same way textures do. They rely on the garbage collector when references are dropped, but manual clearing via `clearCache('model')` is available (though not explicitly exposed in `MemoryBudget` yet).
