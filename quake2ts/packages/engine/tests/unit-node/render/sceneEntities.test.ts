/**
 * Reading game entities as MD2 draws: which entities draw, at which frame and skin, and how
 * items spin and the view weapon sits. No GPU or pak needed.
 */
import { describe, it, expect } from 'vitest';
import type { Md2Model } from '../../../src/assets/md2.js';
import { aliasModelTransform, modelEntitiesFromEntities, viewWeaponEntity } from '../../../src/render/sceneEntities.js';

const model = {
  skins: [{ name: 'models/x/skin.pcx' }, { name: 'models/x/pain.pcx' }],
  frames: [{}, {}, {}],
} as unknown as Md2Model;
const models = new Map([['models/x/tris.md2', model]]);
const names = ['', 'maps/demo1.bsp', '*1', 'models/x/tris.md2', 'models/missing/tris.md2'];
const at = (x: number) => ({ x, y: 0, z: 0 });
const none = { x: 0, y: 0, z: 0 };

describe('modelEntitiesFromEntities', () => {
  it('draws loaded MD2s at their frame and skin, and skips the rest', () => {
    const player = { modelindex: 3, origin: at(9), angles: none };
    const drawn = modelEntitiesFromEntities(
      [
        { modelindex: 3, origin: at(1), angles: none, frame: 2, skin: 1 },
        { modelindex: 3, origin: at(2), angles: none, frame: 99 }, // clamped to the last frame
        { modelindex: 2, origin: at(3), angles: none }, // a brush model
        { modelindex: 4, origin: at(4), angles: none }, // not loaded
        { modelindex: 3, origin: at(5), angles: none, svflags: 1 }, // hidden
        { modelindex: 3, origin: at(6), angles: none, inUse: false },
        player,
      ],
      (i) => names[i],
      { models, viewer: player }
    );
    expect(drawn.map((d) => d.transform[12])).toEqual([1, 2]);
    expect(drawn[0].blend).toEqual({ frame0: 2, frame1: 2, lerp: 0 });
    expect(drawn[0].skin).toBe('models/x/pain.pcx');
    expect(drawn[1].blend.frame0).toBe(2);
    expect(drawn[1].skin).toBe('models/x/skin.pcx');
  });

  it('blends from the old frame when the source gives one, clamping both', () => {
    const drawn = modelEntitiesFromEntities(
      [
        { modelindex: 3, origin: none, angles: none, oldFrame: 0, frame: 1, frameLerp: 0.25 },
        { modelindex: 3, origin: none, angles: none, oldFrame: 99, frame: 1, frameLerp: 0.5 },
        { modelindex: 3, origin: none, angles: none, oldFrame: 0, frame: 1, frameLerp: 1 },
      ],
      (i) => names[i],
      { models }
    );
    expect(drawn.map((d) => d.blend)).toEqual([
      { frame0: 0, frame1: 1, lerp: 0.25 },
      { frame0: 2, frame1: 1, lerp: 0.5 },
      { frame0: 1, frame1: 1, lerp: 0 },
    ]);
  });

  it('spins items with EF_ROTATE at 100 degrees a second', () => {
    const [item] = modelEntitiesFromEntities(
      [{ modelindex: 3, origin: none, angles: { x: 0, y: 45, z: 0 }, effects: 1 }],
      (i) => names[i],
      { models, timeSeconds: 0.9 }
    );
    const expected = aliasModelTransform(none, { x: 0, y: 90, z: 0 });
    for (let i = 0; i < 16; i++) expect(item.transform[i]).toBeCloseTo(expected[i]);
  });
});

describe('aliasModelTransform', () => {
  it('negates pitch, as R_DrawAliasModel does', () => {
    // R_DrawAliasModel negates only pitch before R_RotateForEntity, so positive pitch tips the
    // model's +x down, as the view's forward vector tips.
    const m = aliasModelTransform(none, { x: 90, y: 0, z: 0 });
    expect(m[2]).toBeCloseTo(-1);
  });
});

describe('viewWeaponEntity', () => {
  it('places the weapon at the eye, turned with the view, flagged as the view model', () => {
    const weapon = viewWeaponEntity({ origin: { x: 1, y: 2, z: 3 }, angles: { x: 0, y: 90, z: 0 }, model: 'models/x/tris.md2', frame: 1, models });
    expect(weapon?.isViewModel).toBe(true);
    expect(Array.from(weapon!.transform.slice(12, 15))).toEqual([1, 2, 3]);
    expect(weapon!.transform[1]).toBeCloseTo(1); // yaw 90: forward is +y
    expect(viewWeaponEntity({ origin: none, angles: none, model: undefined, frame: 0, models })).toBeUndefined();
  });

  it('blends the weapon between frames', () => {
    const weapon = viewWeaponEntity({ origin: none, angles: none, model: 'models/x/tris.md2', oldFrame: 1, frame: 2, frameLerp: 0.5, models });
    expect(weapon?.blend).toEqual({ frame0: 1, frame1: 2, lerp: 0.5 });
  });
});
