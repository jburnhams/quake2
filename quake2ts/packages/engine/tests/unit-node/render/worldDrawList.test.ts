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
import {
  animatedTextureName, brushModelTransform, buildWorldDrawList, isTransparentSurface,
  type BrushModelInstance, type WorldDrawSurface,
} from '../../../src/render/worldDrawList.js';
import { brushModelsFromEntities } from '../../../src/render/sceneEntities.js';
import { DEMO1_SHOTS, DEMO_PAK, demoPakAvailable, shotBrushModels } from '../../demo1/shots.js';

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

  const listFor = (shotIndex: number, timeSeconds = 0, brushModels?: readonly BrushModelInstance[]) => {
    const shot = DEMO1_SHOTS[shotIndex];
    const camera = new Camera(320, 240);
    camera.fov = 90;
    camera.setPosition(...shot.origin);
    camera.setRotation(...shot.angles);
    return buildWorldDrawList(world, {
      cameraPosition: { x: shot.origin[0], y: shot.origin[1], z: shot.origin[2] },
      viewProjection: camera.viewProjectionMatrix,
      timeSeconds,
      brushModels,
    });
  };
  const shotIndex = (name: string) => DEMO1_SHOTS.findIndex((s) => s.name === name);

  it('draws a visible subset of the map, without sky, opaque apart from translucent', () => {
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

  it('groups opaque faces that share everything into batches, with one index array for both passes', () => {
    const list = listFor(0);
    const keyOf = (d: (typeof list.opaque)[number]) =>
      [d.texture, d.lightmapAtlas, d.surface.surfaceFlags, d.styleIndices.join(), d.transform].join('|');
    // No two opaque batches share a key: each texture chain is drawn once.
    const keys = list.opaque.filter((d) => d.startsBatch).map(keyOf);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.opaqueBatches.length + list.transparentBatches.length).toBe(list.batches);
    expect(list.batches).toBeLessThan(list.opaque.length / 2);

    // Each batch's indices are its faces' own triangles, moved to where they sit in the world buffer.
    const vertices = prepared.geometry.vertices!;
    expect(list.indices).toBeDefined();
    for (const [draws, batches] of [[list.opaque, list.opaqueBatches], [list.transparent, list.transparentBatches]] as const) {
      for (const batch of batches) {
        let at = batch.firstIndex;
        for (const draw of draws.slice(batch.first, batch.first + batch.count)) {
          expect(keyOf(draw)).toBe(keyOf(draws[batch.first]));
          const { indexData, vertexData, firstVertex } = draw.surface as WorldDrawSurface & { vertexData: Float32Array };
          for (const index of indexData!) {
            const worldIndex = list.indices![at++];
            expect(worldIndex).toBe(index + firstVertex!);
            expect(vertices[worldIndex * 8]).toBe(vertexData[index * 8]);
          }
        }
        expect(at).toBe(batch.firstIndex + batch.indexCount);
      }
    }
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

  it('draws a brush model in view with its transform, and leaves it out of the world walk', () => {
    const door = shotIndex('door-shut');
    const without = listFor(door);
    const doorFaces = new Set(Array.from({ length: map.models[19].numFaces }, (_, i) => map.models[19].firstFace + i));
    expect(without.opaque.some((d) => doorFaces.has(d.faceIndex))).toBe(false);

    const instances = shotBrushModels(map, DEMO1_SHOTS[door]);
    const withDoor = listFor(door, 0, instances);
    const drawn = withDoor.opaque.filter((d) => doorFaces.has(d.faceIndex));
    expect(drawn.length).toBeGreaterThan(0);
    for (const d of drawn) expect(d.transform).toBeDefined();
    for (const d of withDoor.opaque) if (!doorFaces.has(d.faceIndex) && d.transform === undefined) expect(d.faceIndex).toBeLessThan(map.models[0].numFaces);
    // A change of transform starts a batch, so a backend sets the model matrix there.
    expect(drawn.some((d) => d.startsBatch)).toBe(true);
  });

  it('culls a brush model outside the view and moves one by its origin', () => {
    const door = shotIndex('door-shut');
    const behind: BrushModelInstance = { model: 19, origin: { x: 4000, y: 0, z: 0 } };
    expect(listFor(door, 0, [behind]).opaque.some((d) => d.transform)).toBe(false);

    const raised = brushModelTransform({ model: 19, origin: { x: 0, y: 0, z: 120 } });
    expect(Array.from(raised.slice(12, 15))).toEqual([0, 0, 120]);
    // Yaw 90 turns +x into +y, as R_RotateForEntity does.
    const turned = brushModelTransform({ model: 1, origin: { x: 0, y: 0, z: 0 }, angles: { x: 0, y: 90, z: 0 } });
    expect(turned[0]).toBeCloseTo(0);
    expect(turned[1]).toBeCloseTo(1);
    // Pitch and roll turn the drawn model the way the collision model turns (angleVectors):
    // R_DrawBrushModel cancels R_RotateForEntity's negations. Pitch 90 tips +x to -z (down).
    const pitched = brushModelTransform({ model: 1, origin: { x: 0, y: 0, z: 0 }, angles: { x: 90, y: 0, z: 0 } });
    expect(pitched[2]).toBeCloseTo(-1);
    // Roll 90 turns +y (left) to +z, as angleVectors' right vector (-y at rest) turns to -z.
    const rolled = brushModelTransform({ model: 1, origin: { x: 0, y: 0, z: 0 }, angles: { x: 0, y: 0, z: 90 } });
    expect(rolled[6]).toBeCloseTo(1);
  });

  it('reads brush models from entities, skipping free slots, hidden entities and non-submodels', () => {
    const at = { x: 1, y: 2, z: 3 };
    const none = { x: 0, y: 0, z: 0 };
    const names = ['', 'maps/demo1.bsp', '*19', '*1', 'models/items/armor/shard/tris.md2'];
    const instances = brushModelsFromEntities(
      [
        { modelindex: 2, origin: at, angles: none, inUse: true },
        { modelindex: 3, origin: none, angles: none, svflags: 1 }, // a trigger
        { modelindex: 2, origin: none, angles: none, inUse: false },
        { modelindex: 4, origin: none, angles: none },
        { modelindex: 0, origin: none, angles: none },
      ],
      (i) => names[i]
    );
    expect(instances).toEqual([{ model: 19, origin: at, angles: none }]);
  });
});
