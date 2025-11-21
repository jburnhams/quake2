import { PakArchive, Pic, Renderer } from '@quake2ts/engine';
import { PlayerClient, WEAPON_ITEMS, WeaponItem, PowerupId } from '@quake2ts/game';
import { HUD_LAYOUT } from './layout.js';

const iconPics = new Map<string, Pic>();

const ICON_NAMES = [
    // Weapons
    'w_blaster', 'w_shotgun', 'w_sshotgun', 'w_machinegun', 'w_chaingun',
    'w_glauncher', 'w_rlauncher', 'w_hyperblaster', 'w_railgun', 'w_bfg',
    'w_grapple',
    // Ammo
    'a_grenades', 'a_bullets', 'a_cells', 'a_rockets', 'a_shells', 'a_slugs',
    // Powerups
    'p_quad', 'p_invulnerability', 'p_silencer', 'p_rebreather', 'p_envirosuit',
    'p_adrenaline', 'p_megahealth',
    // Armor
    'i_jacketarmor', 'i_combatarmor', 'i_bodyarmor', 'i_powerscreen', 'i_powershield',
    // Keys
    'k_datacd', 'k_powercube', 'k_pyramid', 'k_dataspin', 'k_security', 'k_bluekey', 'k_redkey'
];

export const Init_Icons = async (renderer: Renderer, pak: PakArchive) => {
    for (const name of ICON_NAMES) {
        try {
            const data = pak.readFile(`pics/${name}.pcx`);
            const pic = await renderer.registerPic(name, data.buffer as ArrayBuffer);
            iconPics.set(name, pic);
        } catch (e) {
            console.error(`Failed to load HUD image: pics/${name}.pcx`);
        }
    }
};

export const Draw_Icons = (renderer: Renderer, client: PlayerClient) => {
    if (!client) {
        return;
    }

    // Draw current weapon icon
    const currentWeapon = client.inventory.currentWeapon;
    if (currentWeapon) {
        const weaponDef = Object.values(WEAPON_ITEMS).find((w: WeaponItem) => w.weaponId === currentWeapon);
        if (weaponDef) {
            const iconName = `w_${weaponDef.id.substring(7)}`;
            const icon = iconPics.get(iconName);
            if (icon) {
                renderer.drawPic(HUD_LAYOUT.WEAPON_ICON_X, HUD_LAYOUT.WEAPON_ICON_Y, icon);
            }
        }
    }

    // Draw powerup icons
    let powerupX = HUD_LAYOUT.POWERUP_X;
    for (const [powerup, timer] of client.inventory.powerups.entries()) {
        if (timer && timer > 0) {
            const iconName = `p_${powerup}`;
            const icon = iconPics.get(iconName);
            if (icon) {
                renderer.drawPic(powerupX, HUD_LAYOUT.POWERUP_Y, icon);
                powerupX -= (icon.width + 4); // Move to the left for the next icon
            }
        }
    }
};
