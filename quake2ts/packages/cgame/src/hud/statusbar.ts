import { CGameImport } from '../types.js';
import { Draw_Number } from './numbers.js';
import { getHudLayout } from './layout.js';
import { PlayerState, PlayerStat, G_GetAmmoStat, G_GetPowerupStat } from '@quake2ts/shared';

let colorblindMode = false;

export const Set_ColorblindMode = (enabled: boolean) => {
    colorblindMode = enabled;
};

/**
 * Draws the status bar (health, armor, ammo, icons) using ps.stats.
 *
 * NOTE: This implementation relies on the server correctly populating ps.stats
 * (STAT_HEALTH, STAT_ARMOR, STAT_AMMO, etc.) and valid configstring mappings
 * for icons (STAT_SELECTED_ICON, STAT_ARMOR_ICON, etc.).
 *
 * If ps.stats is not yet populated by the server (or is empty), the HUD will
 * display zeros or nothing. This is expected behavior during the migration phase.
 */
export const Draw_StatusBar = (
    cgi: CGameImport,
    ps: PlayerState,
    hudNumberPics: readonly unknown[],
    numberWidth: number,
    timeMs: number,
    layout: ReturnType<typeof getHudLayout>
) => {
    // Stat Indices
    const health = ps.stats[PlayerStat.STAT_HEALTH] || 0;
    const armor = ps.stats[PlayerStat.STAT_ARMOR] || 0;
    const ammo = ps.stats[PlayerStat.STAT_AMMO] ? G_GetAmmoStat(ps.stats[PlayerStat.STAT_AMMO]) : 0;

    // Icon Indices (into ConfigStrings or predefined map)
    const armorIconIdx = ps.stats[PlayerStat.STAT_ARMOR_ICON] || 0;
    const ammoIconIdx = ps.stats[PlayerStat.STAT_AMMO_ICON] || 0;
    // const selectedIconIdx = ps.stats[PlayerStat.STAT_SELECTED_ICON] || 0;

    // NOTE: In Q2, STAT_SELECTED_ICON is an index into CS_IMAGES (configstrings).
    // We currently might lack the ConfigString system fully wired to resolve this index
    // to a path like "pics/w_railgun.pcx".
    //
    // For now, if the server passes us `ps.pickupIcon` (a temporary Q2TS field) or
    // we have a way to resolve it, we draw it.
    // Original Q2 used: cgi.configstring(CS_IMAGES + ps.stats[STAT_SELECTED_ICON])

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
    // Ideally: const iconName = cgi.get_configstring(CS_IMAGES + armorIconIdx);
    // But we need to make sure we have that constant available.
    // For now, if we can't resolve it, we skip.
    // If the server hasn't sent configstrings yet, this will be skipped.
    if (armorIconIdx > 0) {
         // TODO: Implement proper configstring lookup for icons
         // const iconName = cgi.get_configstring(CS_IMAGES + armorIconIdx);
         // const icon = cgi.Draw_RegisterPic(iconName);
         // if (icon) cgi.SCR_DrawPic(layout.ARMOR_X - 24, layout.ARMOR_Y - 2, icon);
    }

    // Draw Weapon Icon
    // Uses STAT_SELECTED_ICON
    if (ps.pickupIcon) {
         // Fallback to legacy string field if present, helpful for transition
         const icon = cgi.Draw_RegisterPic(ps.pickupIcon);
         if (icon) {
             cgi.SCR_DrawPic(layout.WEAPON_ICON_X, layout.WEAPON_ICON_Y, icon);
         }
    } else {
        // Standard Q2 path via STAT_SELECTED_ICON
        /*
        const selectedIconIdx = ps.stats[PlayerStat.STAT_SELECTED_ICON];
        if (selectedIconIdx > 0) {
             // const iconName = cgi.get_configstring(CS_IMAGES + selectedIconIdx);
             // const icon = cgi.Draw_RegisterPic(iconName);
             // if (icon) cgi.SCR_DrawPic(layout.WEAPON_ICON_X, layout.WEAPON_ICON_Y, icon);
        }
        */
    }

    // Draw Keys
    // Rerelease/Q2 uses STAT_LAYOUTS to determine if inventory/keys overlay is shown.
    // But for the persistent key icons on the HUD (Q2TS specific feature?), we might need logic.
    // Standard Q2 doesn't show key icons on the main HUD, only in inventory.
    // If we want to keep Q2TS specific key icons, we need to know which keys we have.
    // Since we don't have the inventory set in ps.stats easily (unless packed),
    // we might lose this feature until we implement a "Key Stat" or read inventory bits.
    //
    // For now, we omit the key drawing if we don't have the data, matching standard Q2 behavior.

    // Draw Powerups
    // Handled by Draw_Blends or STAT_TIMER logic usually.
};
