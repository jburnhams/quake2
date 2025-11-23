import { AssetManager, Pic, Renderer } from '@quake2ts/engine';
import { PlayerClient, WEAPON_ITEMS, WeaponItem, PowerupId } from '@quake2ts/game';
import { HUD_LAYOUT } from './layout.js';
import { Draw_Number } from './numbers.js';

export const iconPics = new Map<string, Pic>();

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

export const Init_Icons = async (renderer: Renderer, assets: AssetManager) => {
    for (const name of ICON_NAMES) {
        try {
            const texture = await assets.loadTexture(`pics/${name}.pcx`);
            const pic = renderer.registerTexture(name, texture);
            iconPics.set(name, pic);
        } catch (e) {
            console.error(`Failed to load HUD image: pics/${name}.pcx`);
        }
    }
};

export const Draw_Icons = (
    renderer: Renderer,
    client: PlayerClient,
    hudNumberPics: readonly Pic[],
    numberWidth: number,
    timeMs: number
) => {
    if (!client) {
        return;
    }

    // Draw armor icon
    const armor = client.inventory.armor;
    if (armor && armor.armorCount > 0) {
        const iconName = `i_${armor.armorType}armor`;
        const icon = iconPics.get(iconName);
        if (icon) {
            renderer.drawPic(HUD_LAYOUT.ARMOR_X - 24, HUD_LAYOUT.ARMOR_Y - 2, icon);
        }
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
                renderer.drawPic(HUD_LAYOUT.WEAPON_ICON_X, keyY, icon);
                keyY += icon.height + 2;
            }
        }
    }
};
