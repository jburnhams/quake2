import { Entity, MoveType, Solid } from '../entity.js';
import { SpawnRegistry } from '../spawn.js';

function SP_monster_stub(self: Entity): void {
  self.movetype = MoveType.Step;
  self.solid = Solid.BoundingBox;
  self.mins = { x: -16, y: -16, z: -24 };
  self.maxs = { x: 16, y: 16, z: 32 };
  self.health = 100;
  // TODO: Add proper monster implementation
  // console.log(`Spawned stub monster: ${self.classname}`);
}

const STUB_MONSTERS = [
  'monster_gunner',
  'monster_infantry',
  'monster_berserker',
  'monster_gladiator',
  'monster_medic',
  'monster_mutant',
  'monster_parasite',
  'monster_flyer',
  'monster_brain',
  'monster_floater',
  'monster_hover',
  'monster_tank',
  'monster_tank_commander',
  'monster_super_tank',
  'monster_boss2',
  'monster_boss3_stand',
  'monster_jorg',
  'monster_makron',
  'monster_chick',
  'monster_flipper',
  'monster_insane',
];

export function registerMonsterStubs(registry: SpawnRegistry): void {
  for (const monster of STUB_MONSTERS) {
    registry.register(monster, SP_monster_stub);
  }
}
