import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    SP_monster_soldier,
    SP_monster_soldier_light,
    SP_monster_soldier_ssg,
    SP_monster_soldier_ripper,
    SP_monster_soldier_hypergun,
    SP_monster_soldier_lasergun
} from '../../../src/entities/monsters/soldier.js';
import { Entity } from '../../../src/entities/entity.js';
import { createTestContext } from '../../test-helpers.js';

describe('soldier_variants', () => {
  let context: any;
  let spawnContext: any;
  let soldier: Entity;

  beforeEach(() => {
    const testCtx = createTestContext();
    context = testCtx.entities;
    spawnContext = { entities: context, health_multiplier: 1 } as any;

    soldier = {
      index: 1,
      origin: { x: 0, y: 0, z: 0 },
      angles: { x: 0, y: 0, z: 0 },
      classname: 'monster_soldier',
      spawnflags: 0,
      monsterinfo: {},
    } as any;
  });

  it('should spawn regular soldier', () => {
      SP_monster_soldier(soldier, spawnContext);
      expect(soldier.health).toBe(20);
      expect(soldier.skin).toBe(0);
      expect(soldier.style).toBeUndefined();
  });

  it('should spawn light soldier', () => {
      soldier.classname = 'monster_soldier_light';
      SP_monster_soldier_light(soldier, spawnContext);
      expect(soldier.health).toBe(10);
      expect(soldier.skin).toBe(0);
      expect(soldier.spawnflags & 1).toBe(1); // SOLDIER_LIGHT
  });

  it('should spawn ssg soldier', () => {
      soldier.classname = 'monster_soldier_ssg';
      SP_monster_soldier_ssg(soldier, spawnContext);
      expect(soldier.health).toBe(30);
      expect(soldier.skin).toBe(2);
      expect(soldier.spawnflags & 2).toBe(2); // SOLDIER_SSG
  });

  // Need to check if Xatrix variants are implemented and registered.
  // Based on reading the file, they are.
  it('should spawn ripper soldier', () => {
      soldier.classname = 'monster_soldier_ripper';
      SP_monster_soldier_ripper(soldier, spawnContext);
      expect(soldier.health).toBe(50);
      expect(soldier.skin).toBe(6);
      expect(soldier.style).toBe(1);
  });

  it('should spawn hypergun soldier', () => {
      soldier.classname = 'monster_soldier_hypergun';
      SP_monster_soldier_hypergun(soldier, spawnContext);
      expect(soldier.health).toBe(60);
      expect(soldier.skin).toBe(8);
      expect(soldier.style).toBe(1);
  });

  it('should spawn lasergun soldier', () => {
      soldier.classname = 'monster_soldier_lasergun';
      SP_monster_soldier_lasergun(soldier, spawnContext);
      expect(soldier.health).toBe(70);
      expect(soldier.skin).toBe(10);
      expect(soldier.style).toBe(1);
  });
});
