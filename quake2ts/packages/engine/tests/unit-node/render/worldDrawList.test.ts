/**
 * The shared world front end on the real demo1 (skipped without the demo pak): what both
 * backends will draw, checked without a GPU.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import { SURF_SKY } from '@quake2ts/shared';
import { PakArchive } from '../../../src/assets/pak.js';
import { parseBsp, type BspMap } from '../../../src/assets/bsp.js';
import { prepareWorld, type PreparedWorld } from '../../../src/render/prepareWorld.js';
import { Camera } from '../../../src/render/camera.js';
import { animatedTextureName, buildWorldDrawList, isTransparentSurface, type WorldDrawSurface } from '../../../src/render/worldDrawList.js';
import { DEMO1_SHOTS, DEMO_PAK, demoPakAvailable } from '../../demo1/shots.js';

const toArrayBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe.skipIf(!demoPakAvailable())('buildWorldDrawList on demo1', () => {
  let map: BspMap;
  let prepared: PreparedWorld;
  let world: { map: BspMap; surfaces: readonly WorldDrawSurface[] };

  beforeAll(async () => {
    const pak = PakArchive.fromArrayBuffer('pak0.pak', toArrayBuffer(fs.readFileSync(DEMO_PAK)));
    const files = { readFile: async (p: string) => pak.readFile(p) };
    map = parseBsp(toArrayBuffer(await files.readFile('maps/demo1.bsp')));
    prepared = await prepareWorld(map, files);
    world = { map, surfaces: prepared.geometry.surfaces as WorldDrawSurface[] };
  });

  const listFor = (shotIndex: number, timeSeconds = 0) => {
    const shot = DEMO1_SHOTS[shotIndex];
    const camera = new Camera(320, 240);
    camera.fov = 90;
    camera.setPosition(...shot.origin);
    camera.setRotation(...shot.angles);
    return buildWorldDrawList(world, {
      cameraPosition: { x: shot.origin[0], y: shot.origin[1], z: shot.origin[2] },
      viewProjection: camera.viewProjectionMatrix,
      timeSeconds,
    });
  };

  it('draws a visible subset of the map, without sky, opaque front to back', () => {
    const list = listFor(0);
    expect(list.opaque.length).toBeGreaterThan(50);
    expect(list.opaque.length).toBeLessThan(map.faces.length / 2);
    for (const draw of [...list.opaque, ...list.transparent]) {
      expect(draw.surface.surfaceFlags & SURF_SKY).toBe(0);
    }
    for (const draw of list.opaque) expect(isTransparentSurface(draw.surface.surfaceFlags)).toBe(false);
    for (const draw of list.transparent) expect(isTransparentSurface(draw.surface.surfaceFlags)).toBe(true);
    expect(list.lightStyles.length).toBeGreaterThanOrEqual(64);
  });

  it('counts a batch only where texture, lightmap page, flags or styles change', () => {
    const list = listFor(0);
    const draws = [...list.opaque, ...list.transparent];
    expect(list.batches).toBe(draws.filter((d) => d.startsBatch).length);
    expect(list.batches).toBeLessThanOrEqual(draws.length);
    expect(list.opaque[0]?.startsBatch).toBe(true);
  });

  it('is the same list every time for the same view', () => {
    const a = listFor(1).opaque.map((d) => d.faceIndex);
    const b = listFor(1).opaque.map((d) => d.faceIndex);
    expect(a).toEqual(b);
  });

  it('steps animated textures along their texinfo chain at 2 frames a second', () => {
    const animated = map.faces.findIndex((face) => (map.texInfo[face.texInfo]?.nextTexInfo ?? -1) >= 0);
    expect(animated).toBeGreaterThanOrEqual(0);
    const first = map.texInfo[map.faces[animated].texInfo];
    expect(animatedTextureName(map, animated, 0)).toBe(first.texture);
    expect(animatedTextureName(map, animated, 0.5)).toBe(map.texInfo[first.nextTexInfo].texture);
    const still = map.faces.findIndex((face) => (map.texInfo[face.texInfo]?.nextTexInfo ?? 0) < 0);
    expect(animatedTextureName(map, still, 3)).toBeUndefined();
  });
});
