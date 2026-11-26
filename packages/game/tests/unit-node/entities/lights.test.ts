import { describe, it, expect } from 'vitest';
import { ConfigStringIndex, DEFAULT_LIGHT_STYLES } from '@quake2ts/shared';
import { registerLightSpawns, SP_light, SPAWNFLAG_LIGHT_START_OFF } from '../../../src/entities/lights.js';
import { SpawnRegistry } from '../../../src/entities/spawn.js';
import { Entity, Solid, MoveType } from '../../../src/entities/entity.js';
import { createTestContext } from '@quake2ts/test-utils';

function light(fields: Partial<Entity>): Entity {
  const ent = new Entity(5);
  ent.inUse = true;
  Object.assign(ent, { classname: 'light', ...fields });
  return ent;
}

describe('lights', () => {
  it('registers light spawns', () => {
    const registry = new SpawnRegistry();
    registerLightSpawns(registry);
    expect(registry.get('light')).toBe(SP_light);
    expect(registry.get('light_mine1')).toBeDefined();
    expect(registry.get('light_mine2')).toBeDefined();
  });

  it('frees a light nothing targets, as SP_light does: it is only for qrad3', () => {
    const context = createTestContext();
    const ent = light({ style: 6 });
    SP_light(ent, context);
    expect(context.free).toHaveBeenCalledWith(ent);
    expect(context.entities.imports.configstring).not.toHaveBeenCalled();
  });

  it('keeps a targeted light non-solid, and leaves a low style to the table', () => {
    const context = createTestContext();
    const ent = light({ targetname: 't1', style: 6 });
    SP_light(ent, context);
    expect(context.free).not.toHaveBeenCalled();
    expect(ent.solid).toBe(Solid.Not);
    expect(ent.movetype).toBe(MoveType.None);
    expect(ent.use).toBeUndefined();
  });

  it('switches a switchable style between on and off', () => {
    const context = createTestContext();
    const configstring = context.entities.imports.configstring;
    const ent = light({ targetname: 't1', style: 33 });
    SP_light(ent, context);
    expect(configstring).toHaveBeenLastCalledWith(ConfigStringIndex.Lights + 33, 'm');

    ent.use!(ent, null, null);
    expect(configstring).toHaveBeenLastCalledWith(ConfigStringIndex.Lights + 33, 'a');
    expect(ent.spawnflags & SPAWNFLAG_LIGHT_START_OFF).toBe(SPAWNFLAG_LIGHT_START_OFF);

    ent.use!(ent, null, null);
    expect(configstring).toHaveBeenLastCalledWith(ConfigStringIndex.Lights + 33, 'm');
  });

  it('starts off with START_OFF, and reads style_on as a pattern or a table style', () => {
    const context = createTestContext();
    context.keyValues = { style_on: '6', style_off: 'b' };
    const configstring = context.entities.imports.configstring;
    const ent = light({ targetname: 't1', style: 40, spawnflags: SPAWNFLAG_LIGHT_START_OFF });
    SP_light(ent, context);
    expect(configstring).toHaveBeenLastCalledWith(ConfigStringIndex.Lights + 40, 'b');
    ent.use!(ent, null, null);
    expect(configstring).toHaveBeenLastCalledWith(ConfigStringIndex.Lights + 40, DEFAULT_LIGHT_STYLES.get(6)!.pattern);
  });
});

