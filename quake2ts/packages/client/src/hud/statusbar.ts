import { Pic, Renderer } from '@quake2ts/engine';
import { PlayerClient, WeaponItem, WEAPON_ITEMS } from '@quake2ts/game';
import { Draw_Number } from './numbers.js';
import { HUD_LAYOUT } from './layout.js';
import { iconPics } from './icons.js';

export const Draw_StatusBar = (
    renderer: Renderer,
    client: PlayerClient,
    health: number,
    armor: number,
    ammo: number,
    hudNumberPics: readonly Pic[],
    numberWidth: number,
    timeMs: number
) => {
    // Draw Health
    const healthColor: [number, number, number, number] | undefined = health <= 25
        ? [1, 0, 0, 1] // Red for low health
        : undefined;

    if (hudNumberPics.length > 0) {
        Draw_Number(renderer, HUD_LAYOUT.HEALTH_X, HUD_LAYOUT.HEALTH_Y, health, hudNumberPics, numberWidth, healthColor);
        Draw_Number(renderer, HUD_LAYOUT.ARMOR_X, HUD_LAYOUT.ARMOR_Y, armor, hudNumberPics, numberWidth);
        Draw_Number(renderer, HUD_LAYOUT.AMMO_X, HUD_LAYOUT.AMMO_Y, ammo, hudNumberPics, numberWidth);
    }

    // Draw Armor Icon
    const armorItem = client.inventory.armor;
    if (armorItem && armorItem.armorCount > 0) {
        const iconName = `i_${armorItem.armorType}armor`;
        const icon = iconPics.get(iconName);
        if (icon) {
            renderer.drawPic(HUD_LAYOUT.ARMOR_X - 24, HUD_LAYOUT.ARMOR_Y - 2, icon);
        }
    }

    // Draw Ammo Icon (implied by Ammo count? No, usually there's an icon for the ammo type)
    // The current implementation in `icons.ts` didn't seem to draw ammo icon, just weapon icon.
    // Let's check `Draw_Icons` in `icons.ts`.
    // It draws Armor Icon, Weapon Icon, Powerup Icons, Keys.

    // We should check if we need to draw Ammo Icon.
    // Rerelease HUD usually shows ammo count. Sometimes an icon too.
    // The task list says "Ammo count for current weapon" [x].
    // "Weapon icon" [x].

    // Draw Weapon Icon
    const currentWeapon = client.inventory.currentWeapon;
    if (currentWeapon) {
        const weaponDef = Object.values(WEAPON_ITEMS).find((w: WeaponItem) => w.weaponId === currentWeapon);
        if (weaponDef) {
            const iconName = `w_${weaponDef.id.substring(7)}`; // remove 'weapon_' prefix?
            // id is usually 'weapon_shotgun', we want 'w_shotgun'.
            // existing icons.ts logic: `w_${weaponDef.id.substring(7)}`

            const icon = iconPics.get(iconName);
            if (icon) {
                renderer.drawPic(HUD_LAYOUT.WEAPON_ICON_X, HUD_LAYOUT.WEAPON_ICON_Y, icon);
            }
        }
    }

    // Draw Picked up item icon is handled separately in Draw_Pickup usually,
    // but we can consolidate if we want.
    // `Draw_Hud` calls `Draw_Pickup`.

    // Draw Keys
    const keys = Array.from(client.inventory.keys).sort();
    let keyY = 300;

    for (const key of keys) {
        let iconName = '';
        switch (key) {
            case 'blue': iconName = 'k_bluekey'; break;
            case 'red': iconName = 'k_redkey'; break;
            case 'green': iconName = 'k_security'; break;
            case 'yellow': iconName = 'k_pyramid'; break;
        }

        if (iconName) {
            const icon = iconPics.get(iconName);
            if (icon) {
                // Existing logic draws keys at WEAPON_ICON_X, but vertically stacked?
                // `renderer.drawPic(HUD_LAYOUT.WEAPON_ICON_X, keyY, icon);`
                // It seems to overlap if we are not careful.
                // WEAPON_ICON_Y is 450. keyY starts at 300.
                renderer.drawPic(HUD_LAYOUT.WEAPON_ICON_X, keyY, icon);
                keyY += icon.height + 2;
            }
        }
    }

    // Draw Powerups
    let powerupX = HUD_LAYOUT.POWERUP_X;
    for (const [powerup, expiresAt] of client.inventory.powerups.entries()) {
        if (expiresAt && expiresAt > timeMs) {
            const iconName = `p_${powerup}`;
            const icon = iconPics.get(iconName);
            if (icon) {
                renderer.drawPic(powerupX, HUD_LAYOUT.POWERUP_Y, icon);

                // Draw remaining time
                const remainingSeconds = Math.ceil((expiresAt - timeMs) / 1000);
                Draw_Number(renderer, powerupX + icon.width + 2, HUD_LAYOUT.POWERUP_Y, remainingSeconds, hudNumberPics, numberWidth);

                powerupX -= (icon.width + numberWidth * remainingSeconds.toString().length + 8);
            }
        }
    }
};
