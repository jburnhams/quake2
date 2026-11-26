import { BspMap, BspTexInfo } from '../assets/bsp.js';
import { MaterialManager, BlendMode } from './materials.js';
import { Texture2D } from './resources.js';
import { SURF_FLOWING, SURF_WARP, SURF_TRANS33, SURF_TRANS66, SURF_ALPHATEST, SURF_SKY } from '@quake2ts/shared';

export function createMaterialsFromMap(
    map: BspMap,
    textures: ReadonlyMap<string, Texture2D>,
    materialManager: MaterialManager
): void {
    // Collect all textures used in the map
    const textureNames = new Set<string>();

    // We can iterate surfaces (texInfo)
    // BspMap stores texInfo, but face references it.
    // map.texInfo is an array of BspTexInfo

    // 1. Group animated textures
    // Quake 2 animated textures start with +0, +1, etc.
    // We want to group them into a single material.

    // Scan all available textures in the texture map to find animations?
    // Or scan what is used in the map?
    // The map contains texInfo with texture names.

    const usedTextures = new Set<string>();
    for (const texInfo of map.texInfo) {
        if (!texInfo) continue;
        usedTextures.add(texInfo.texture);
    }

    // Helper to check if a texture is part of an animation sequence
    const isAnimFrame = (name: string): boolean => {
        return name.length > 2 && name.startsWith('+') && !isNaN(parseInt(name[1], 10));
    };

    // Find animation sets
    const animSets = new Map<string, string[]>();
    const singles = new Set<string>();

    // We need to look at all textures in the *TextureManager* (or passed map) to find all frames,
    // because the map might only reference +0 but the animation should play +1 etc.
    // However, usually the map loader loads all textures referenced.
    // Quake 2 convention: if a map references +0foo, the engine should also look for +1foo, +2foo...

    // For now, let's assume `textures` contains all loaded textures, including frames.
    // We'll iterate the `textures` map keys.

    for (const name of textures.keys()) {
        if (isAnimFrame(name)) {
            const digit = parseInt(name[1], 10);
            const base = name.substring(2);
            // We group by the suffix?
            // E.g. +0button and +1button belong together.
            // Key them by `button`? Or `+0button`?
            // If we key by `button`, we might clash if there is a `button` texture.
            // Let's key by the `+0` version if possible, or a special key.
            // Quake 2 Rerelease might handle this specifically.

            // Simpler approach:
            // For every texture starting with +0, look for +1, +2...
            if (name.startsWith('+0')) {
                const frames: string[] = [name];
                let i = 1;
                while (true) {
                    const nextName = `+${i}${base}`;
                    if (textures.has(nextName)) {
                        frames.push(nextName);
                        i++;
                    } else {
                        break;
                    }
                }
                animSets.set(name, frames);

                // Also map other frames to this set?
                // When we look up material for `+1button`, we should get the same material as `+0button`.
                for (let j = 1; j < frames.length; j++) {
                     // We'll handle aliasing later or just register same material multiple times?
                     // Registering same material logic for each key is safer for lookup.
                     animSets.set(frames[j], frames);
                }
            }
        } else {
            singles.add(name);
        }
    }

    // Now create materials for all used textures
    for (const texInfo of map.texInfo) {
        if (!texInfo) continue;
        const name = texInfo.texture;

        if (materialManager.getMaterial(name)) continue;

        let frames: string[] = [name];
        let fps = 10; // Default

        if (animSets.has(name)) {
            frames = animSets.get(name)!;
        }

        // Find Texture2D objects
        const matTextures: Texture2D[] = [];
        for (const frameName of frames) {
            const tex = textures.get(frameName);
            if (tex) {
                matTextures.push(tex);
            }
        }

        if (matTextures.length === 0) continue;

        // Determine flags from texInfo
        const flags = texInfo.flags;

        let blendMode = BlendMode.OPAQUE;
        if (flags & SURF_TRANS33) blendMode = BlendMode.ALPHA; // 0.33
        if (flags & SURF_TRANS66) blendMode = BlendMode.ALPHA; // 0.66
        // SURF_ALPHATEST?

        const scroll: [number, number] = [0, 0];
        if (flags & SURF_FLOWING) {
            scroll[0] = 2.0; // Standard flow speed
            scroll[1] = 2.0;
            // Q2 source: scroll speed is hardcoded or derived?
            // "Flowing" usually implies a specific shader effect.
            // Scrolling logic in Quake 2 is usually hardcoded -2 per frame?
        }

        const warp = (flags & SURF_WARP) !== 0;

        materialManager.registerMaterial(name, {
            textures: matTextures,
            fps,
            blendMode,
            warp,
            scroll,
            // twoSided?
        });
    }
}
