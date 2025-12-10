import { Entity, DeadFlag, Solid, MoveType, EntityFlags } from '../entities/entity.js';
import { EntitySystem } from '../entities/system.js';
import { GameExports } from '../index.js';
import { createPlayerInventory, WeaponId, resetInventory } from '../inventory/playerInventory.js';
import { createPlayerWeaponStates } from '../combat/weapons/state.js';
import { WEAPON_ITEMS } from '../inventory/items.js';
import { vec3 } from 'gl-matrix';
import { ClientCommand, ServerCommand, TempEntity } from '@quake2ts/shared';
import { P_PlayerThink } from '../entities/player.js';
import { MulticastType } from '../imports.js';

export function PutClientInServer(ent: Entity, sys: EntitySystem) {
    // Locate a spawn point
    SelectSpawnPoint(ent, sys);

    // Set up default player state
    ent.health = 100;
    ent.max_health = 100;
    ent.deadflag = DeadFlag.Alive;
    ent.solid = Solid.BoundingBox;
    ent.movetype = MoveType.Walk;
    // ent.flags &= ~EntityFlags.Dead;
    ent.takedamage = true;
    ent.viewheight = 22;
    ent.mass = 200;

    ent.model = 'players/male/tris.md2'; // Default
    ent.mins = { x: -16, y: -16, z: -24 };
    ent.maxs = { x: 16, y: 16, z: 32 };

    // Reset Inventory if needed (usually handled by caller if fresh spawn)
    if (!ent.client) {
         ent.client = {
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
            currentAmmoCount: 0,
            anim_end: 0,
            anim_priority: 0,
            damage_alpha: 0,
            damage_blend: [0,0,0],
            quad_time: 0,
            double_time: 0,
            quadsound_time: 0,
            invincible_time: 0,
            breather_time: 0,
            enviro_time: 0,
            buttons: 0,
            pm_type: 0,
            pm_time: 0,
            pm_flags: 0,
            gun_frame: 0,
            rdflags: 0,
            fov: 90,
            pers: {
                connected: true,
                inventory: [],
                health: 100,
                max_health: 100,
                savedFlags: 0,
                selected_item: 0
            }
        };
    } else {
        // Clear powerups and reset basic stats
        resetInventory(ent.client.inventory);
        ent.client.inventory.currentWeapon = WeaponId.Blaster;
        ent.client.weaponStates = createPlayerWeaponStates();
    }

    // Give Blaster
    if (ent.client) {
        ent.client.inventory.items.add('Blaster');
        ent.client.inventory.currentWeapon = WeaponId.Blaster;
    }

    // Telefrag check
    KillBox(ent, sys);

    // Initial think
    ent.nextthink = sys.timeSeconds + 0.1;
    ent.think = (s) => P_PlayerThink(s, sys);
    sys.scheduleThink(ent, ent.nextthink);
}

export function Respawn(ent: Entity, sys: EntitySystem) {
    if (sys.deathmatch) {
        PutClientInServer(ent, sys);

        // Add spawn effect
        sys.multicast(ent.origin, MulticastType.Pvs, ServerCommand.temp_entity, TempEntity.TELEPORT_EFFECT, ent.origin);
    } else {
        // Single player restart logic (usually handled by game loop / loading)
        sys.imports.serverCommand('restart');
    }
}

export function SelectSpawnPoint(ent: Entity, sys: EntitySystem) {
    const spawnPoints: Entity[] = [];

    // Find all info_player_deathmatch
    if (sys.deathmatch) {
        sys.forEachEntity((e) => {
            if (e.classname === 'info_player_deathmatch') {
                spawnPoints.push(e);
            }
        });
    }

    // Fallback to info_player_start
    if (spawnPoints.length === 0) {
        sys.forEachEntity((e) => {
            if (e.classname === 'info_player_start') {
                spawnPoints.push(e);
            }
        });
    }

    if (spawnPoints.length === 0) {
        // No spawn points? Use 0,0,0
        ent.origin = { x: 0, y: 0, z: 0 };
        ent.angles = { x: 0, y: 0, z: 0 };
        return;
    }

    // Pick random spawn point
    const index = Math.floor(Math.random() * spawnPoints.length);
    const spot = spawnPoints[index];

    ent.origin = { ...spot.origin };
    ent.angles = { ...spot.angles };

    // Slight offset to avoid floor clipping?
    ent.origin = { x: ent.origin.x, y: ent.origin.y, z: ent.origin.z + 1 };
}

export function KillBox(ent: Entity, sys: EntitySystem) {
    // Stub
}
