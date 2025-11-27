import { CGameImport } from '../types.js';
import { Draw_Number } from './numbers.js';
import { iconPics } from './icons.js';
import { getHudLayout } from './layout.js';
import { ClientState, WEAPON_ICON_MAP, KEY_ICON_MAP } from './types.js';

let colorblindMode = false;

export const Set_ColorblindMode = (enabled: boolean) => {
    colorblindMode = enabled;
};

export const Draw_StatusBar = (
    cgi: CGameImport,
    client: ClientState,
    health: number,
    armor: number,
    ammo: number,
    hudNumberPics: readonly unknown[],
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
        Draw_Number(cgi, layout.HEALTH_X, layout.HEALTH_Y, health, hudNumberPics, numberWidth, healthColor);
        Draw_Number(cgi, layout.ARMOR_X, layout.ARMOR_Y, armor, hudNumberPics, numberWidth);
        Draw_Number(cgi, layout.AMMO_X, layout.AMMO_Y, ammo, hudNumberPics, numberWidth);
    }

    // Draw Armor Icon
    const armorItem = client.inventory.armor;
    if (armorItem && armorItem.armorCount > 0) {
        const iconName = `i_${armorItem.armorType}armor`;
        const icon = iconPics.get(iconName);
        if (icon) {
            cgi.SCR_DrawPic(layout.ARMOR_X - 24, layout.ARMOR_Y - 2, icon);
        }
    }

    // Draw Weapon Icon
    const currentWeapon = client.inventory.currentWeapon;
    if (currentWeapon) {
        const iconName = WEAPON_ICON_MAP[currentWeapon];
        if (iconName) {
            const icon = iconPics.get(iconName);
            if (icon) {
                cgi.SCR_DrawPic(layout.WEAPON_ICON_X, layout.WEAPON_ICON_Y, icon);
            }
        }
    }

    // Draw Keys
    const keys = Array.from(client.inventory.keys).sort();
    let keyY = layout.WEAPON_ICON_Y - 150 * layout.scale; // Stack above weapon icon?

    for (const key of keys) {
        const iconName = KEY_ICON_MAP[key];
        if (iconName) {
            const icon = iconPics.get(iconName);
            if (icon) {
                const size = cgi.Draw_GetPicSize(icon);
                cgi.SCR_DrawPic(layout.WEAPON_ICON_X, keyY, icon);
                keyY += (size.height + 2);
            }
        }
    }

    // Draw Powerups
    let powerupX = layout.POWERUP_X;
    for (const [powerup, expiresAt] of Array.from(client.inventory.powerups.entries())) {
        if (expiresAt && expiresAt > timeMs) {
            const iconName = `p_${powerup}`;
            const icon = iconPics.get(iconName);
            if (icon) {
                const size = cgi.Draw_GetPicSize(icon);
                cgi.SCR_DrawPic(powerupX, layout.POWERUP_Y, icon);

                // Draw remaining time
                const remainingSeconds = Math.ceil((expiresAt - timeMs) / 1000);
                Draw_Number(cgi, powerupX + size.width + 2, layout.POWERUP_Y, remainingSeconds, hudNumberPics, numberWidth);

                powerupX -= (size.width + numberWidth * remainingSeconds.toString().length + 8);
            }
        }
    }
};
