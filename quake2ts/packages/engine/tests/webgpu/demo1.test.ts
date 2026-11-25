/**
 * demo1 render gate, WebGPU backend (Dawn in Node). See tests/demo1/shots.ts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import { setupHeadlessWebGPUEnv, captureTexture } from '@quake2ts/test-utils';
import { PakArchive } from '../../src/assets/pak.js';
import { parseBsp } from '../../src/assets/bsp.js';
import { prepareWorld, type PreparedWorld } from '../../src/render/prepareWorld.js';
import { createWebGPURenderer, type WebGPURenderer } from '../../src/render/webgpu/renderer.js';
import { Camera } from '../../src/render/camera.js';
import { prepareModels } from '../../src/render/prepareModels.js';
import { modelEntitiesFromEntities, viewWeaponEntity } from '../../src/render/sceneEntities.js';
import type { RenderableEntity } from '../../src/render/scene.js';
import type { WorldRenderState } from '../../src/render/frame.js';
import {
  DEMO1_SHOTS, DEMO_PAK, SHOT_WIDTH, SHOT_HEIGHT, CLEAR_COLOR, SHOT_EXPECTATIONS,
  analyseShot, demoPakAvailable, expectShotBaseline, shotBrushModels, shotModelEntities, shotParticles,
} from '../demo1/shots.js';

const toArrayBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe.skipIf(!demoPakAvailable())('demo1 (WebGPU)', () => {
  let renderer: WebGPURenderer;
  let prepared: PreparedWorld;
  let world: WorldRenderState;
  const errors: string[] = [];
  let files: { readFile(path: string): Promise<Uint8Array> };

  beforeAll(async () => {
    await setupHeadlessWebGPUEnv();
    const pak = PakArchive.fromArrayBuffer('pak0.pak', toArrayBuffer(fs.readFileSync(DEMO_PAK)));
    files = { readFile: async (p: string) => pak.readFile(p) };
    const map = parseBsp(toArrayBuffer(await files.readFile('maps/demo1.bsp')));
    prepared = await prepareWorld(map, files);

    renderer = await createWebGPURenderer(undefined, { width: SHOT_WIDTH, height: SHOT_HEIGHT });
    renderer.resize(SHOT_WIDTH, SHOT_HEIGHT);
    renderer.device.onuncapturederror = (event) => { errors.push(event.error.message); };
    world = renderer.uploadWorld(prepared);
  });

  afterAll(async () => {
    renderer?.dispose();
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  it('finds every texture the map names', () => {
    expect(prepared.missingTextures).toEqual([]);
    expect(prepared.textures.size).toBeGreaterThan(100);
  });

  for (const shot of DEMO1_SHOTS) {
    it(`renders ${shot.name} textured and lit`, async () => {
      const camera = new Camera(SHOT_WIDTH, SHOT_HEIGHT);
      camera.fov = 90;
      camera.setPosition(...shot.origin);
      camera.setRotation(...shot.angles);

      renderer.device.pushErrorScope('validation');
      const brushModels = shotBrushModels(prepared.map, shot);
      const { names, entities: sources } = shotModelEntities(prepared.map, shot);
      const models = await prepareModels(files, [...names, ...(shot.viewWeapon ? [shot.viewWeapon.model] : [])]);
      expect(models.missing).toEqual([]);
      renderer.uploadModels(world, models);
      const entities: RenderableEntity[] = modelEntitiesFromEntities(sources, (i) => names[i], { models: models.models });
      const weapon = viewWeaponEntity({
        origin: { x: shot.origin[0], y: shot.origin[1], z: shot.origin[2] },
        angles: { x: shot.angles[0], y: shot.angles[1], z: shot.angles[2] },
        model: shot.viewWeapon?.model, frame: shot.viewWeapon?.frame ?? 0, oldFrame: shot.viewWeapon?.oldFrame, frameLerp: shot.viewWeapon?.frameLerp, models: models.models,
      });
      if (weapon) entities.push(weapon);
      renderer.particleSystem.killAll();
      for (const particle of shotParticles(shot)) renderer.particleSystem.spawn(particle);
      renderer.renderFrame({ camera, world, clearColor: CLEAR_COLOR, timeSeconds: 0, brushModels }, entities);
      const validation = await renderer.device.popErrorScope();
      expect(validation?.message ?? null).toBeNull();

      const target = (renderer as unknown as { frameRenderer: { headlessTarget: GPUTexture } }).frameRenderer.headlessTarget;
      const pixels = await captureTexture(renderer.device, target, SHOT_WIDTH, SHOT_HEIGHT);
      const stats = analyseShot(pixels, SHOT_WIDTH, SHOT_HEIGHT);
      console.log(`webgpu ${shot.name}`, JSON.stringify(stats));
      await expectShotBaseline('webgpu', shot.name, pixels);

      expect(errors).toEqual([]);
      expect(stats.coverage).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minCoverage - (shot.sky ?? 0));
      expect(stats.distinctColors).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minDistinctColors);
      expect(stats.meanLuminance).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minLuminance);
      expect(stats.meanLuminance).toBeLessThanOrEqual(SHOT_EXPECTATIONS.maxLuminance);
      expect(stats.detail).toBeGreaterThanOrEqual(SHOT_EXPECTATIONS.minDetail);
    });
  }
});
