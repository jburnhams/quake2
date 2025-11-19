import { describe, expect, it } from 'vitest';
import {
  EntitySystem,
  applyEntityKeyValues,
  createDefaultSpawnRegistry,
  MoveType,
  ServerFlags,
  parseEntityLump,
  Solid,
  spawnEntitiesFromText,
  spawnEntityFromDictionary,
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

  it('defers target activation using delay before firing', () => {
    const system = new EntitySystem();

    const trigger = system.spawn();
    trigger.classname = 'delay_source';
    trigger.target = 'wait_for_it';
    trigger.delay = 0.4;
    system.finalizeSpawn(trigger);

    const target = system.spawn();
    target.classname = 'delayed_target';
    target.targetname = 'wait_for_it';
    let uses = 0;
    target.use = () => {
      uses += 1;
    };
    system.finalizeSpawn(target);

    system.beginFrame(0);
    system.useTargets(trigger, trigger);
    system.runFrame();
    expect(uses).toBe(0);

    system.beginFrame(0.39);
    system.runFrame();
    expect(uses).toBe(0);

    system.beginFrame(0.4);
    system.runFrame();
    expect(uses).toBe(1);
  });
});

describe('Trigger spawns', () => {
  function spawnPlayer(system: EntitySystem) {
    const player = system.spawn();
    player.classname = 'player';
    player.svflags = ServerFlags.Player;
    player.mins = { x: -8, y: -8, z: -8 };
    player.maxs = { x: 8, y: 8, z: 8 };
    player.solid = Solid.BoundingBox;
    player.takedamage = true;
    player.health = 100;
    system.finalizeSpawn(player);
    return player;
  }

  function spawnMonster(system: EntitySystem) {
    const monster = system.spawn();
    monster.classname = 'monster';
    monster.svflags = ServerFlags.Monster;
    monster.takedamage = true;
    monster.health = 50;
    monster.mins = { x: -8, y: -8, z: -8 };
    monster.maxs = { x: 8, y: 8, z: 8 };
    monster.solid = Solid.BoundingBox;
    system.finalizeSpawn(monster);
    return monster;
  }

  it('trigger_multiple respects wait, activator, and gating rules', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_multiple',
        target: 'door',
        wait: '0.5',
        mins: '-16 -16 -16',
        maxs: '16 16 16',
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('trigger failed to spawn');
    }

    const door = system.spawn();
    door.classname = 'func_door';
    door.targetname = 'door';
    let uses = 0;
    door.use = (_self, other, activator) => {
      uses += 1;
      expect(other).toBe(trigger);
      expect(activator?.classname).toBe('player');
    };
    system.finalizeSpawn(door);

    const player = spawnPlayer(system);
    void player;

    system.beginFrame(0);
    system.runFrame();
    expect(uses).toBe(1);

    system.beginFrame(0.25);
    system.runFrame();
    expect(uses).toBe(1);

    system.beginFrame(0.5);
    system.runFrame();
    expect(uses).toBe(2);
  });

  it('trigger_once frees itself after the first activation', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_once',
        target: 'once_target',
        mins: '-8 -8 -8',
        maxs: '8 8 8',
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('trigger failed to spawn');
    }

    const target = system.spawn();
    target.classname = 'target';
    target.targetname = 'once_target';
    let uses = 0;
    target.use = () => {
      uses += 1;
    };
    system.finalizeSpawn(target);

    spawnPlayer(system);

    system.beginFrame(0);
    system.runFrame();
    expect(uses).toBe(1);

    system.beginFrame(1 / 40);
    system.runFrame();

    expect(system.findByClassname('trigger_once')).toHaveLength(0);
  });

  it('trigger_multiple with TRIGGERED stays inactive until enabled', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_multiple',
        target: 'delayed_target',
        mins: '-8 -8 -8',
        maxs: '8 8 8',
        spawnflags: `${1 << 2}`,
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('trigger failed to spawn');
    }
    expect(trigger.solid).toBe(Solid.Not);

    const target = system.spawn();
    target.classname = 'target_delay';
    target.targetname = 'delayed_target';
    let uses = 0;
    target.use = () => {
      uses += 1;
    };
    system.finalizeSpawn(target);

    spawnPlayer(system);

    system.beginFrame(0);
    system.runFrame();
    expect(uses).toBe(0);

    trigger.use?.(trigger, null, trigger);
    system.beginFrame(0);
    system.runFrame();
    expect(uses).toBe(1);
  });

  it('trigger_relay forwards use to its targets', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const relay = spawnEntityFromDictionary(
      { classname: 'trigger_relay', target: 'relay_target' },
      { registry, entities: system },
    );
    if (!relay) {
      throw new Error('relay failed to spawn');
    }

    const target = system.spawn();
    target.classname = 'target_temp';
    target.targetname = 'relay_target';
    let uses = 0;
    target.use = () => {
      uses += 1;
    };
    system.finalizeSpawn(target);

    relay.use?.(relay, null, relay);
    expect(uses).toBe(1);
    system.beginFrame(0);
    system.runFrame();
    expect(uses).toBe(1);
  });

  it('trigger_always schedules its targets immediately with a default delay', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const always = spawnEntityFromDictionary(
      { classname: 'trigger_always', target: 'fire_me' },
      { registry, entities: system },
    );
    if (!always) {
      throw new Error('always failed to spawn');
    }

    const target = system.spawn();
    target.classname = 'target_always';
    target.targetname = 'fire_me';
    let uses = 0;
    target.use = () => {
      uses += 1;
    };
    system.finalizeSpawn(target);

    system.beginFrame(0);
    system.runFrame();
    expect(uses).toBe(0);

    system.beginFrame(0.2);
    system.runFrame();
    expect(uses).toBe(1);
  });

  it('trigger_push applies velocity and removes itself when PUSH_ONCE is set', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_push',
        angles: '0 90 0',
        speed: '800',
        spawnflags: `${1 << 0}`,
        mins: '-16 -16 -16',
        maxs: '16 16 16',
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('push failed to spawn');
    }

    const player = spawnPlayer(system);
    player.velocity = { x: 0, y: 0, z: 0 };

    system.beginFrame(0);
    system.runFrame();
    expect(player.velocity.y).toBeCloseTo(8000);
    expect(player.velocity.x).toBeCloseTo(0, 6);
    expect(player.velocity.z).toBeCloseTo(0, 6);

    system.beginFrame(0.1);
    system.runFrame();
    expect(system.findByClassname('trigger_push')).toHaveLength(0);
  });

  it('trigger_push uses default movedir when angles are omitted', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_push',
        mins: '-16 -16 -16',
        maxs: '16 16 16',
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('push failed to spawn');
    }

    const player = spawnPlayer(system);
    player.velocity = { x: 0, y: 0, z: 0 };

    system.beginFrame(0);
    system.runFrame();

    expect(player.velocity.x).toBeCloseTo(10000);
    expect(player.velocity.y).toBeCloseTo(0, 6);
    expect(player.velocity.z).toBeCloseTo(0, 6);
  });

  it('trigger_push respects START_OFF toggling and push_plus timing', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_push',
        angles: '0 90 0',
        spawnflags: `${(1 << 3) | (1 << 1)}`,
        wait: '0.1',
        mins: '-8 -8 -8',
        maxs: '8 8 8',
        targetname: 'pusher',
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('push_plus failed to spawn');
    }

    const player = spawnPlayer(system);

    system.beginFrame(0);
    system.runFrame();
    expect(player.velocity).toEqual({ x: 0, y: 0, z: 0 });

    trigger.use?.(trigger, null, trigger);

    player.velocity = { x: 0, y: 0, z: 0 };
    system.beginFrame(0.05);
    system.runFrame();
    expect(player.velocity.y).toBeCloseTo(10000);
    expect(player.velocity.x).toBeCloseTo(0, 6);
    expect(player.velocity.z).toBeCloseTo(0, 6);

    player.velocity = { x: 0, y: 0, z: 0 };
    system.beginFrame(0.1);
    system.runFrame();
    expect(player.velocity).toEqual({ x: 0, y: 0, z: 0 });

    player.velocity = { x: 0, y: 0, z: 0 };
    system.beginFrame(0.2);
    system.runFrame();
    expect(player.velocity.y).toBeCloseTo(10000);
    expect(player.velocity.x).toBeCloseTo(0, 6);
    expect(player.velocity.z).toBeCloseTo(0, 6);

    trigger.use?.(trigger, null, trigger);
    player.velocity = { x: 0, y: 0, z: 0 };
    system.beginFrame(0.25);
    system.runFrame();
    expect(player.velocity).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('trigger_hurt applies periodic damage and honours player/monster filters', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_hurt',
        dmg: '7',
        mins: '-8 -8 -8',
        maxs: '8 8 8',
        spawnflags: `${1 << 5}`,
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('hurt failed to spawn');
    }

    const player = spawnPlayer(system);
    const monster = spawnMonster(system);
    player.health = 30;
    monster.health = 40;

    system.beginFrame(0);
    system.runFrame();
    expect(player.health).toBe(30);
    expect(monster.health).toBe(33);

    system.beginFrame(0.05);
    system.runFrame();
    expect(monster.health).toBe(33);

    system.beginFrame(0.11);
    system.runFrame();
    expect(monster.health).toBe(26);
  });

  it('trigger_hurt toggles on use when START_OFF and TOGGLE are set', () => {
    const system = new EntitySystem();
    const registry = createDefaultSpawnRegistry();
    const trigger = spawnEntityFromDictionary(
      {
        classname: 'trigger_hurt',
        dmg: '10',
        spawnflags: `${(1 << 0) | (1 << 1)}`,
        mins: '-8 -8 -8',
        maxs: '8 8 8',
      },
      { registry, entities: system },
    );
    if (!trigger) {
      throw new Error('hurt toggle failed to spawn');
    }

    const player = spawnPlayer(system);
    player.health = 25;

    system.beginFrame(0);
    system.runFrame();
    expect(player.health).toBe(25);

    trigger.use?.(trigger, null, trigger);
    system.beginFrame(0.01);
    system.runFrame();
    expect(player.health).toBe(15);

    trigger.use?.(trigger, null, trigger);
    system.beginFrame(0.2);
    system.runFrame();
    expect(player.health).toBe(15);
  });
});
