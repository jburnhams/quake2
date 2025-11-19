import { describe, expect, it } from 'vitest';
import {
  EntitySystem,
  applyEntityKeyValues,
  createDefaultSpawnRegistry,
  MoveType,
  parseEntityLump,
  Solid,
  spawnEntitiesFromText,
} from '../src/entities/index.js';

describe('Entity lump parsing', () => {
  it('parses multiple entities and ignores underscored keys', () => {
    const lump = `
    {
      "classname" "worldspawn"
      "message" "Unit Test"
      "_editor" "ignore me"
    }
    {
      "classname" "info_player_start"
      "origin" "1 2 3"
      "angle" "90"
      "spawnflags" "2"
    }`;

    const entities = parseEntityLump(lump);
    expect(entities).toHaveLength(2);
    expect(entities[0]).toEqual({ classname: 'worldspawn', message: 'Unit Test' });
    expect(entities[1]).toEqual({ classname: 'info_player_start', origin: '1 2 3', angle: '90', spawnflags: '2' });
  });

  it('throws on malformed entity text', () => {
    const malformed = '{ "classname" "worldspawn"';
    expect(() => parseEntityLump(malformed)).toThrow();
  });
});

describe('Key/value application', () => {
  it('coerces types and updates derived size', () => {
    const system = new EntitySystem();
    const entity = system.spawn();

    applyEntityKeyValues(entity, {
      classname: 'info_player_start',
      origin: '10 20 30',
      angles: '1 2 3',
      spawnflags: '7',
      takedamage: '1',
      mins: '-16 -16 -24',
      maxs: '16 16 32',
    });

    expect(entity.classname).toBe('info_player_start');
    expect(entity.origin).toEqual({ x: 10, y: 20, z: 30 });
    expect(entity.angles).toEqual({ x: 1, y: 2, z: 3 });
    expect(entity.spawnflags).toBe(7);
    expect(entity.takedamage).toBe(true);
    expect(entity.size).toEqual({ x: 32, y: 32, z: 56 });
  });

  it('uses angle as yaw when angles are not provided', () => {
    const system = new EntitySystem();
    const entity = system.spawn();

    applyEntityKeyValues(entity, {
      classname: 'info_player_start',
      angle: '-45',
    });

    expect(entity.angles).toEqual({ x: 0, y: -45, z: 0 });
  });
});

describe('Spawn registry and entity spawning', () => {
  it('spawns known entities and runs default spawn functions', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const warnings: string[] = [];

    const lump = `
    {
      "classname" "worldspawn"
    }
    {
      "classname" "info_player_start"
      "origin" "0 0 24"
    }
    {
      "classname" "info_null"
    }
    {
      "classname" "unknown_class"
    }`;

    const spawned = spawnEntitiesFromText(lump, {
      registry,
      entities: system,
      onWarning: (message) => warnings.push(message),
    });

    expect(spawned.some((entity) => entity.classname === 'worldspawn')).toBe(true);
    expect(system.world.movetype).toBe(MoveType.Push);
    expect(system.world.solid).toBe(Solid.Bsp);

    const activeClassnames: string[] = [];
    system.forEachEntity((entity) => activeClassnames.push(entity.classname));
    expect(activeClassnames).toContain('info_player_start');
    expect(activeClassnames).not.toContain('info_null');

    expect(warnings.some((warning) => warning.includes('unknown_class'))).toBe(true);
  });

  it('warns and skips entities with no classname', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const warnings: string[] = [];

    const lump = `
    {
      "target" "nope"
    }`;

    const spawned = spawnEntitiesFromText(lump, {
      registry,
      entities: system,
      onWarning: (message) => warnings.push(message),
    });

    expect(spawned).toHaveLength(0);
    expect(warnings).toHaveLength(1);
  });
});

describe('Targeting and entity linking', () => {
  it('indexes targetnames during spawn and updates on free', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();

    const lump = `
    {
      "classname" "worldspawn"
    }
    {
      "classname" "info_notnull"
      "targetname" "relay"
    }
    {
      "classname" "info_notnull"
      "targetname" "relay"
    }`;

    const spawned = spawnEntitiesFromText(lump, { registry, entities: system });
    expect(spawned).toHaveLength(3);

    const matches = system.findByTargetName('relay');
    expect(matches).toHaveLength(2);
    expect(system.findByClassname('info_notnull')).toHaveLength(2);

    system.free(matches[0]!);
    system.runFrame();

    const remaining = system.findByTargetName('relay');
    expect(remaining).toHaveLength(1);
  });

  it('activates targets and processes killtargets', () => {
    const system = new EntitySystem();

    const activator = system.spawn();
    activator.classname = 'activator';

    const trigger = system.spawn();
    trigger.classname = 'trigger';
    trigger.target = 'use_me';
    trigger.killtarget = 'remove_me';
    system.finalizeSpawn(trigger);

    const target = system.spawn();
    target.classname = 'target';
    target.targetname = 'use_me';
    const useCalls: Array<{ self: string; other: string | null; activator: string | null }> = [];
    target.use = (self, other, useActivator) => {
      useCalls.push({
        self: self.classname,
        other: other?.classname ?? null,
        activator: useActivator?.classname ?? null,
      });
    };
    system.finalizeSpawn(target);

    const victim = system.spawn();
    victim.classname = 'victim';
    victim.targetname = 'remove_me';
    system.finalizeSpawn(victim);

    system.useTargets(trigger, activator);
    system.runFrame();

    expect(useCalls).toEqual([
      { self: 'target', other: 'trigger', activator: 'activator' },
    ]);
    expect(system.findByClassname('victim')).toHaveLength(0);
  });
});
