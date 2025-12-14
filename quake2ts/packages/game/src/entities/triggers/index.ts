import type { SpawnRegistry } from '../spawn.js';
import { registerTriggerMultiple } from './multiple.js';
import { registerTriggerOnce } from './once.js';
import { registerTriggerRelay } from './relay.js';
import { registerTriggerAlways } from './always.js';
import { registerTriggerCounter } from './counter.js';
import { registerTriggerKey } from './key.js';
import { registerTriggerPush } from './push.js';
import { registerTriggerHurt } from './hurt.js';
import { registerTriggerTeleport } from './teleport.js';
import { registerTriggerGravity } from './gravity.js';
import { registerTriggerElevator } from './elevator.js';
import { registerTriggerMonsterJump } from './monsterjump.js';
import { registerTriggerFog } from './fog.js';
import { registerTriggerFlashlight } from './flashlight.js';
import { registerTriggerSecret } from './secret.js';
import { registerTriggerLook } from './look.js';
import { registerBadArea } from './bad_area.js';

export function registerTriggerSpawns(registry: SpawnRegistry): void {
  registerTriggerMultiple(registry);
  registerTriggerOnce(registry);
  registerTriggerRelay(registry);
  registerTriggerAlways(registry);
  registerTriggerCounter(registry);
  registerTriggerKey(registry);
  registerTriggerPush(registry);
  registerTriggerHurt(registry);
  registerTriggerTeleport(registry);
  registerTriggerGravity(registry);
  registerTriggerElevator(registry);
  registerTriggerMonsterJump(registry);
  registerTriggerFog(registry);
  registerTriggerFlashlight(registry);
  registerTriggerSecret(registry);
  registerTriggerLook(registry);
  registerBadArea(registry);
}
