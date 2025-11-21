import { describe, it, expect } from 'vitest';
import { createDefaultSpawnRegistry, spawnEntityFromDictionary } from '../../src/entities/spawn.js';
import { EntitySystem } from '../../src/entities/system.js';
import { MoveType, Solid } from '../../src/entities/entity.js';

describe('Misc Entities', () => {
  const registry = createDefaultSpawnRegistry();
  const entities = new EntitySystem(2048);

  it('misc_teleporter should be created', () => {
    const entity = spawnEntityFromDictionary({ classname: 'misc_teleporter' }, { registry, entities });
    expect(entity).not.toBeNull();
  });

  it('misc_teleporter_dest should be created', () => {
    const entity = spawnEntityFromDictionary({ classname: 'misc_teleporter_dest' }, { registry, entities });
    expect(entity).not.toBeNull();
  });

  it('misc_explobox should be created with correct properties', () => {
    const entity = spawnEntityFromDictionary({ classname: 'misc_explobox' }, { registry, entities });
    expect(entity).not.toBeNull();
    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.None);
  });

  it('misc_banner should be created with correct properties', () => {
    const entity = spawnEntityFromDictionary({ classname: 'misc_banner' }, { registry, entities });
    expect(entity).not.toBeNull();
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.movetype).toBe(MoveType.None);
  });

  it('misc_deadsoldier should be created with correct properties', () => {
    const entity = spawnEntityFromDictionary({ classname: 'misc_deadsoldier' }, { registry, entities });
    expect(entity).not.toBeNull();
    expect(entity.solid).toBe(Solid.Bsp);
    expect(entity.movetype).toBe(MoveType.None);
  });

  it('misc_gib_arm should be created with correct properties', () => {
    const entity = spawnEntityFromDictionary({ classname: 'misc_gib_arm' }, { registry, entities });
    expect(entity).not.toBeNull();
    expect(entity.solid).toBe(Solid.Not);
    expect(entity.movetype).toBe(MoveType.Toss);
  });
});
