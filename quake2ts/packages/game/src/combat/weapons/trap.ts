
import { Entity } from '../../entities/entity.js';
import { EntitySystem } from '../../entities/system.js';
import { GameExports } from '../../index.js';
import { WeaponStateEnum } from './state.js';
import { WeaponId } from '../../inventory/playerInventory.js';
import { AmmoType } from '../../inventory/ammo.js';
import { P_ProjectSource } from './projectSource.js';
import { Throw_Generic } from './animation.js';
import { createTrap } from '../../entities/projectiles/trap.js';
import { angleVectors } from '@quake2ts/shared';

// Constants
const TRAP_MINSPEED = 300.0;
const TRAP_MAXSPEED = 700.0;
const TRAP_TIMER = 5.0; // 5 seconds to max charge?

export function Trap_Think(player: Entity, sys: EntitySystem) {
    const game = sys.engine as unknown as GameExports;

    Throw_Generic(
        player,
        15, // FIRE_LAST
        48, // IDLE_LAST
        5,  // THROW_FIRST
        15, // THROW_LAST (End of throw sequence)
        5,  // PRIME_SOUND frame
        11, // THROW_HOLD
        12, // THROW_FIRE
        (ent: Entity, held: boolean) => {
             // Fire callback
             if (ent.client) {
                 ent.client.inventory.ammo.counts[AmmoType.Trap]--;
             }

             // Calculate speed based on hold time
             let speed = TRAP_MINSPEED;
             if (ent.client && ent.client.grenade_time) {
                  const timeLeft = ent.client.grenade_time - sys.timeSeconds;
                  const chargeTime = 3.0 - timeLeft; // 0 to 3.0

                  speed = TRAP_MINSPEED + (chargeTime * ((TRAP_MAXSPEED - TRAP_MINSPEED) / 3.0));
             }

             if (speed > TRAP_MAXSPEED) speed = TRAP_MAXSPEED;
             if (speed < TRAP_MINSPEED) speed = TRAP_MINSPEED;

             // Project source
             const angles = { ...ent.client!.v_angle! };
             if (angles.x < -62.5) angles.x = -62.5;

             // Use angleVectors to get forward
             const vecs = angleVectors(angles);

             // Offset { 8, 0, -8 }
             const source = P_ProjectSource(game, ent, { x: 8, y: 0, z: -8 }, vecs.forward, vecs.right, vecs.up);

             createTrap(sys, ent, source, vecs.forward, speed);

             // Reset grenade time
             if (ent.client) ent.client.grenade_time = 0;
        },
        sys
    );
}
