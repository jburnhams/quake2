import { describe, it, expect } from 'vitest';
import { SP_worldspawn } from '../../../src/entities/worldspawn.js';
import { Entity, MoveType, Solid } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('SP_worldspawn', () => {
  it('is the world: a pusher drawn as model 1', () => {
    const context = createTestContext();
    const entity = new Entity(0);
    SP_worldspawn(entity, context);
    expect(entity.classname).toBe('worldspawn');
    expect(entity.movetype).toBe(MoveType.Push);
    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.modelindex).toBe(1); // MODELINDEX_WORLD
  });

  it('defaults the sky, its rotation and axis', () => {
    const context = createTestContext();
    context.keyValues = {};
    SP_worldspawn(new Entity(0), context);
    const set = context.entities.imports.configstring;
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.Sky, 'unit1_');
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.SkyRotate, '0 1');
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.SkyAxis, '0 0 0');
  });

  it('puts the item names and the wheels in configstrings', () => {
    const context = createTestContext();
    context.keyValues = {};
    SP_worldspawn(new Entity(0), context);
    const set = context.entities.imports.configstring;
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.Items + 1, '$item_body_armor');
    // the first weapon on the wheel is the grapple (item 7), with no ammo
    expect(set).toHaveBeenCalledWith(ConfigStringIndex.WheelWeapons, expect.stringMatching(/^7\|\d+\|-1\|0\|/));
  });

  it('precaches the blaster and the player sounds', () => {
    const context = createTestContext();
    context.keyValues = {};
    SP_worldspawn(new Entity(0), context);
    expect(context.entities.soundIndex).toHaveBeenCalledWith('player/fry.wav');
    expect(context.entities.soundIndex).toHaveBeenCalledWith('*death1.wav');
    expect(context.entities.modelIndex).toHaveBeenCalledWith('models/weapons/v_blast/tris.md2');
  });
});
