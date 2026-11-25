/**
 * Think_Weapon and the weapon parts of ClientThink and ClientBeginServerFrame (rerelease
 * p_weapon.cpp, p_client.cpp). The weapon runs once a server frame, or straight away from the
 * usercmd when attack is pressed with the weapon ready, so a shot leaves from where the move
 * ended and without waiting for the next frame.
 */
import type { Entity } from '../../entities/entity.js';
import type { EntitySystem } from '../../entities/system.js';
import { WEAPON_ITEMS } from '../../inventory/items.js';
import { WeaponStateEnum } from './state.js';

import { PlayerButton } from '@quake2ts/shared';

const FIRE_BUTTONS = PlayerButton.Attack | PlayerButton.Attack2;

/** Think_Weapon: run the held weapon's think (Weapon_Generic and friends). */
export function Think_Weapon(ent: Entity, sys: EntitySystem): void {
  const client = ent.client;
  if (!client || client.pers?.spectator) return;
  // If just died, the weapon is put away (ChangeWeapon to none), so nothing runs.
  if (ent.health < 1) {
    client.gunindex = 0;
    return;
  }
  const weaponId = client.inventory.currentWeapon;
  if (!weaponId) return;
  const item = Object.values(WEAPON_ITEMS).find((w) => w.weaponId === weaponId);
  item?.think?.(ent, sys);
}

/** ClientThink's button latching, before the move. */
export function latchButtons(ent: Entity, buttons: number): void {
  const client = ent.client;
  if (!client) return;
  client.oldbuttons = client.buttons;
  client.buttons = buttons;
  client.latched_buttons = (client.latched_buttons ?? 0) | (buttons & ~client.oldbuttons);
}

/** ClientThink, after the move: fire from the final position if attack was just pressed. */
export function fireFromUsercmd(ent: Entity, sys: EntitySystem): void {
  const client = ent.client;
  if (!client || !((client.latched_buttons ?? 0) & FIRE_BUTTONS) || client.pers?.spectator) return;
  if (client.weapon_thunk || client.weaponstate !== WeaponStateEnum.WEAPON_READY) return;
  client.weapon_fire_buffered = true;
  if (Math.round((client.weapon_fire_finished ?? 0) * 1000) <= Math.round(sys.timeSeconds * 1000)) {
    client.weapon_thunk = true;
    Think_Weapon(ent, sys);
  }
}

/** ClientBeginServerFrame's weapon step: run the weapon unless the usercmd already did. */
export function weaponBeginServerFrame(ent: Entity, sys: EntitySystem): void {
  const client = ent.client;
  if (!client) return;
  if (!client.weapon_thunk && !client.pers?.spectator) Think_Weapon(ent, sys);
  else client.weapon_thunk = false;
  client.latched_buttons = 0;
}
