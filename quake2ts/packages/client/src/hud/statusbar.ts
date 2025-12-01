import { Pic, Renderer } from '@quake2ts/engine';
import { PlayerClient, WeaponItem, WEAPON_ITEMS, KeyId } from '@quake2ts/game';
import { Draw_Number } from './numbers.js';
import { iconPics } from './icons.js';
import { getHudLayout } from './layout.js';

let colorblindMode = false;

export const Set_ColorblindMode = (enabled: boolean) => {
    colorblindMode = enabled;
};

export const Draw_StatusBar = (
    renderer: Renderer,
    client: PlayerClient,
    health: number,
    armor: number,
    ammo: number,
    hudNumberPics: readonly Pic[],
    numberWidth: number,
    timeMs: number,
    layout: ReturnType<typeof getHudLayout>
) => {
    // Draw Health
    let healthColor: [number, number, number, number] | undefined = undefined;

    if (health <= 25) {
        if (colorblindMode) {
            // Use Blue/Cyan for low health in colorblind mode instead of Red
            healthColor = [0.2, 0.6, 1, 1];
        } else {
            healthColor = [1, 0, 0, 1]; // Red for low health
        }
    }

    if (hudNumberPics.length > 0) {
        Draw_Number(renderer, layout.HEALTH_X, layout.HEALTH_Y, health, hudNumberPics, numberWidth, healthColor);
        Draw_Number(renderer, layout.ARMOR_X, layout.ARMOR_Y, armor, hudNumberPics, numberWidth);
        Draw_Number(renderer, layout.AMMO_X, layout.AMMO_Y, ammo, hudNumberPics, numberWidth);
    }

    // Draw Armor Icon
    const armorItem = client.inventory.armor;
    if (armorItem && armorItem.armorCount > 0) {
        const iconName = `i_${armorItem.armorType}armor`;
        const icon = iconPics.get(iconName);
        if (icon) {
            renderer.drawPic(layout.ARMOR_X - 24, layout.ARMOR_Y - 2, icon);
        }
    }

    // Draw Weapon Icon
    const currentWeapon = client.inventory.currentWeapon;
    if (currentWeapon) {
        const weaponDef = Object.values(WEAPON_ITEMS).find((w: WeaponItem) => w.weaponId === currentWeapon);
        if (weaponDef) {
            const iconName = `w_${weaponDef.id.substring(7)}`;
            const icon = iconPics.get(iconName);
            if (icon) {
                renderer.drawPic(layout.WEAPON_ICON_X, layout.WEAPON_ICON_Y, icon);
            }
        }
    }

    // Draw Keys
    const keys = Array.from(client.inventory.keys).sort();
    let keyY = layout.WEAPON_ICON_Y - 150 * layout.scale; // Stack above weapon icon?

    for (const key of keys) {
        let iconName = '';
        switch (key) {
            case KeyId.Blue: iconName = 'k_bluekey'; break;
            case KeyId.Red: iconName = 'k_redkey'; break;
            case KeyId.Green: iconName = 'k_security'; break;
            case KeyId.Yellow: iconName = 'k_pyramid'; break;
        }

        if (iconName) {
            const icon = iconPics.get(iconName);
            if (icon) {
                renderer.drawPic(layout.WEAPON_ICON_X, keyY, icon);
                keyY += (icon.height + 2);
            }
        }
    }

    // Draw Powerups
    let powerupX = layout.POWERUP_X;
    for (const [powerup, expiresAt] of client.inventory.powerups.entries()) {
        if (expiresAt && expiresAt > timeMs) {
            const iconName = `p_${powerup}`;
            const icon = iconPics.get(iconName);
            if (icon) {
                renderer.drawPic(powerupX, layout.POWERUP_Y, icon);

                // Draw remaining time
                const remainingSeconds = Math.ceil((expiresAt - timeMs) / 1000);
                Draw_Number(renderer, powerupX + icon.width + 2, layout.POWERUP_Y, remainingSeconds, hudNumberPics, numberWidth);

                powerupX -= (icon.width + numberWidth * remainingSeconds.toString().length + 8);
            }
        }
    }
};
