import {
  Entity,
  ServerFlags,
  EntityFlags,
  MoveType,
  Solid,
  AiFlags,
  Reinforcement,
  ReinforcementList
} from '../../entity.js';
import { EntitySystem } from '../../system.js';
import { Vec3, copyVec3, vectorToAngles } from '@quake2ts/shared';
import { registerMonsterSpawns } from '../index.js';

// Local Random Helpers to avoid import issues
const frandom = (min = 0, max = 1): number => min + Math.random() * (max - min);
const crandom = (): number => 2.0 * (Math.random() - 0.5);
const irandom = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

// Helper constants
const MAX_REINFORCEMENTS = 5;
const INVERSE_LOG_SLOTS = Math.pow(2, MAX_REINFORCEMENTS);

// M_SlotsLeft
export function M_SlotsLeft(self: Entity): number {
  const slots = self.monsterinfo.monster_slots || 0;
  const used = self.monsterinfo.monster_used || 0;
  return slots - used;
}

// M_PickValidReinforcements
// filter out the reinforcement indices we can pick given the space we have left
function M_PickValidReinforcements(self: Entity, space: number, output: number[]): void {
  // Clear output array
  output.length = 0;

  if (!self.monsterinfo.reinforcements) return;

  for (let i = 0; i < self.monsterinfo.reinforcements.length; i++) {
    if (self.monsterinfo.reinforcements[i].strength <= space) {
      output.push(i);
    }
  }
}

// M_PickReinforcements
// pick an array of reinforcements to use; note that this does not modify `self`
// Returns: { chosen: number[], count: number }
export function M_PickReinforcements(self: Entity, countRef: number, max_slots: number = 0): { chosen: number[], count: number } {
  const output: number[] = [];
  const chosen: number[] = new Array(MAX_REINFORCEMENTS).fill(255);
  let num_chosen = 0;

  // decide how many things we want to spawn;
  // this is on a logarithmic scale
  // so we don't spawn too much too often.
  let num_slots = Math.max(1, Math.floor(Math.log2(frandom(0, INVERSE_LOG_SLOTS))));

  // we only have this many slots left to use
  let remaining = (self.monsterinfo.monster_slots || 0) - (self.monsterinfo.monster_used || 0);

  for (num_chosen = 0; num_chosen < num_slots; num_chosen++) {
    // ran out of slots!
    if ((max_slots && num_chosen === max_slots) || !remaining) {
      break;
    }

    // get everything we could choose
    M_PickValidReinforcements(self, remaining, output);

    // can't pick any
    if (output.length === 0) {
      break;
    }

    // select monster, TODO fairly
    const randIndex = irandom(0, output.length - 1);
    chosen[num_chosen] = output[randIndex];

    remaining -= self.monsterinfo.reinforcements![chosen[num_chosen]].strength;
  }

  return { chosen, count: num_chosen };
}

// M_SetupReinforcements
export function M_SetupReinforcements(reinforcements: string, list: ReinforcementList): void {
  // list is array, clear it
  list.length = 0;

  if (!reinforcements || reinforcements.length === 0) {
    return;
  }

  const entries = reinforcements.split(';').map(s => s.trim()).filter(s => s.length > 0);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const parts = entry.split(/\s+/); // Split by whitespace

    if (parts.length >= 2) {
      const classname = parts[0];
      const strength = parseInt(parts[1], 10);

      const r: Reinforcement = {
        classname: classname,
        strength: strength,
        mins: { x: 0, y: 0, z: 0 }, // Default, will update
        maxs: { x: 0, y: 0, z: 0 }
      };

      list.push(r);
    }
  }
}

// Overload/Modified M_SetupReinforcements with context to allow spawning for bounds check
export function M_SetupReinforcementsWithContext(reinforcements: string, list: ReinforcementList, context: EntitySystem): void {
  list.length = 0;

  if (!reinforcements || reinforcements.length === 0) return;

  const entries = reinforcements.split(';').map(s => s.trim()).filter(s => s.length > 0);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const parts = entry.split(/\s+/);

    if (parts.length >= 2) {
      const classname = parts[0];
      const strength = parseInt(parts[1], 10);

      const r: Reinforcement = {
        classname: classname,
        strength: strength,
        mins: { x: 0, y: 0, z: 0 },
        maxs: { x: 0, y: 0, z: 0 }
      };

      // Hardcoded lookup for now to avoid circular deps or complex spawning
      if (classname === 'monster_flyer') {
          r.mins = copyVec3({x: -16, y: -16, z: -24});
          r.maxs = copyVec3({x: 16, y: 16, z: 32});
      } else if (classname === 'monster_kamikaze') {
          r.mins = copyVec3({x: -16, y: -16, z: -24});
          r.maxs = copyVec3({x: 16, y: 16, z: 32});
      } else if (classname === 'monster_soldier' || classname === 'monster_soldier_light' || classname === 'monster_soldier_ss') {
          r.mins = copyVec3({x: -16, y: -16, z: -24});
          r.maxs = copyVec3({x: 16, y: 16, z: 32});
      } else if (classname === 'monster_gunner') {
          r.mins = copyVec3({x: -16, y: -16, z: -24});
          r.maxs = copyVec3({x: 16, y: 16, z: 32});
      } else if (classname === 'monster_infantry') {
          r.mins = copyVec3({x: -16, y: -16, z: -24});
          r.maxs = copyVec3({x: 16, y: 16, z: 32});
      } else if (classname === 'monster_medic') {
          r.mins = copyVec3({x: -24, y: -24, z: -24});
          r.maxs = copyVec3({x: 24, y: 24, z: 32});
      } else if (classname === 'monster_gladiator') {
          r.mins = copyVec3({x: -32, y: -32, z: -24});
          r.maxs = copyVec3({x: 32, y: 32, z: 64});
      } else {
          // Fallback
          r.mins = copyVec3({x: -16, y: -16, z: -24});
          r.maxs = copyVec3({x: 16, y: 16, z: 32});
      }

      list.push(r);
    }
  }
}
