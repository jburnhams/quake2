import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Entity } from '../../../../src/entities/entity.js';
import { createTestContext, createEntity, TestContext } from '@quake2ts/test-utils';
import { SP_monster_gunner } from '../../../../src/entities/monsters/gunner.js';
import { SP_monster_gladiator } from '../../../../src/entities/monsters/gladiator.js';
import { SP_monster_tank } from '../../../../src/entities/monsters/tank.js';
import { SP_monster_berserk } from '../../../../src/entities/monsters/berserk.js';
import { SP_monster_infantry } from '../../../../src/entities/monsters/infantry.js';
import { SP_monster_parasite } from '../../../../src/entities/monsters/parasite.js';
import { SP_monster_flyer } from '../../../../src/entities/monsters/flyer.js';
import { SP_monster_brain } from '../../../../src/entities/monsters/brain.js';
import { SP_monster_medic } from '../../../../src/entities/monsters/medic.js';
import { SP_monster_hover } from '../../../../src/entities/monsters/hover.js';
import { SP_monster_mutant } from '../../../../src/entities/monsters/mutant.js';
import { SP_monster_chick } from '../../../../src/entities/monsters/chick.js';
import { SP_monster_flipper } from '../../../../src/entities/monsters/flipper.js';
import { SP_monster_floater } from '../../../../src/entities/monsters/floater.js';
import { SP_monster_icarus } from '../../../../src/entities/monsters/icarus.js';
import { SP_monster_jorg } from '../../../../src/entities/monsters/jorg.js';
import { SP_monster_makron } from '../../../../src/entities/monsters/makron.js';
import { SP_monster_boss2 } from '../../../../src/entities/monsters/boss2.js';
import { SP_monster_arachnid } from '../../../../src/entities/monsters/arachnid.js';
import { SP_monster_guardian } from '../../../../src/entities/monsters/guardian.js';
import { SP_monster_fixbot } from '../../../../src/entities/monsters/fixbot.js';
import { SP_monster_gekk } from '../../../../src/entities/monsters/gekk.js';
import { SP_monster_turret } from '../../../../src/entities/monsters/turret.js';
import { SP_monster_supertank } from '../../../../src/entities/monsters/supertank.js';

// Mock dependencies
vi.mock('../../../../src/entities/monsters/attack.js', () => ({
  monster_fire_bullet: vi.fn(),
  monster_fire_blaster: vi.fn(),
  monster_fire_shotgun: vi.fn(),
  monster_fire_ionripper: vi.fn(),
  monster_fire_blueblaster: vi.fn(),
  monster_fire_dabeam: vi.fn(),
  monster_fire_grenade: vi.fn(),
  monster_fire_rocket: vi.fn(),
  monster_fire_railgun: vi.fn(),
  monster_fire_bfg: vi.fn(),
}));

describe('Monster Health Scaling', () => {
  let context: TestContext;
  let entity: Entity;

  beforeEach(() => {
    context = createTestContext();
    entity = createEntity({ index: 1 });
    vi.clearAllMocks();
  });

  const testCases = [
    { name: 'gunner', sp: SP_monster_gunner, baseHealth: 175 },
    { name: 'gladiator', sp: SP_monster_gladiator, baseHealth: 400 },
    { name: 'tank', sp: SP_monster_tank, baseHealth: 750 },
    { name: 'supertank', sp: SP_monster_supertank, baseHealth: 1500 },
    { name: 'berserk', sp: SP_monster_berserk, baseHealth: 240 },
    { name: 'infantry', sp: SP_monster_infantry, baseHealth: 100 },
    { name: 'parasite', sp: SP_monster_parasite, baseHealth: 175 },
    { name: 'flyer', sp: SP_monster_flyer, baseHealth: 50 },
    { name: 'brain', sp: SP_monster_brain, baseHealth: 300 },
    { name: 'medic', sp: SP_monster_medic, baseHealth: 300 },
    { name: 'hover', sp: SP_monster_hover, baseHealth: 240 },
    { name: 'mutant', sp: SP_monster_mutant, baseHealth: 300 },
    { name: 'chick', sp: SP_monster_chick, baseHealth: 175 },
    { name: 'flipper', sp: SP_monster_flipper, baseHealth: 50 },
    { name: 'floater', sp: SP_monster_floater, baseHealth: 200 },
    { name: 'icarus', sp: SP_monster_icarus, baseHealth: 240 },
    { name: 'jorg', sp: SP_monster_jorg, baseHealth: 3000 },
    { name: 'makron', sp: SP_monster_makron, baseHealth: 3000 },
    { name: 'boss2', sp: SP_monster_boss2, baseHealth: 3000 },
    { name: 'arachnid', sp: SP_monster_arachnid, baseHealth: 1000 },
    { name: 'guardian', sp: SP_monster_guardian, baseHealth: 2500 },
    { name: 'fixbot', sp: SP_monster_fixbot, baseHealth: 150 },
    { name: 'gekk', sp: SP_monster_gekk, baseHealth: 125 },
    { name: 'turret', sp: SP_monster_turret, baseHealth: 100 },
  ];

  testCases.forEach(({ name, sp, baseHealth }) => {
    it(`${name} health scales with multiplier`, () => {
        // Reset entity
        entity = createEntity({ index: 1 });

        // Test with 2.0 multiplier
        context.health_multiplier = 2.0;

        sp(entity, context);

        expect(entity.health).toBe(baseHealth * 2.0);
        expect(entity.max_health).toBe(baseHealth * 2.0);
    });

    it(`${name} health has no scale with 1.0 multiplier`, () => {
        // Reset entity
        entity = createEntity({ index: 1 });

        // Test with 1.0 multiplier
        context.health_multiplier = 1.0;

        sp(entity, context);

        expect(entity.health).toBe(baseHealth);
        expect(entity.max_health).toBe(baseHealth);
    });
  });
});
