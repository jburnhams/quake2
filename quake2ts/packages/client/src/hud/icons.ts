import { PakArchive, Pic, Renderer } from '@quake2ts/engine';
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
        // Original Quake 2 draws armor icon at slightly offset position relative to number
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
                // Draw number to the right or on top? Original Q2 draws it next to icon usually.
                // Let's draw it to the left of the icon for layout.
                // Actually, standard layout might be number then icon, or icon then number.
                // Q2 HUD source: Draw_Powerups draws icon, then number.

                Draw_Number(renderer, powerupX + icon.width + 2, HUD_LAYOUT.POWERUP_Y, remainingSeconds, hudNumberPics, numberWidth);

                powerupX -= (icon.width + numberWidth * remainingSeconds.toString().length + 8);
            }
        }
    }

    // Draw keys
    // In original Quake 2, keys are NOT shown on the main HUD status bar.
    // They appear in the inventory/help overlay (F1).
    // However, the task explicitly asks for "Key icons (if keys collected)" in the status bar section.
    // We will place them on the left side, stacking vertically, as a common mod/port enhancement or expanded HUD feature.
    // We remove the unused map and explicit guesses, relying on the mapping derived from playerInventory.ts logic.

    const keys = Array.from(client.inventory.keys).sort();
    // Using a safe default position on the left, ensuring it doesn't overlap with weapon icon (at bottom).
    let keyY = 300;

    for (const key of keys) {
        let iconName = '';
        switch (key) {
            case 'blue': iconName = 'k_bluekey'; break;
            case 'red': iconName = 'k_redkey'; break;
            // 'green' and 'yellow' keys in KeyId enum map to specific Q2 key items in pickupKey logic.
            // We map them to likely icons for now to provide visual feedback as requested.
            // Future work should align KeyId enum with actual Q2 item names more closely.
            case 'green': iconName = 'k_security'; break;
            case 'yellow': iconName = 'k_pyramid'; break;
        }

        if (iconName) {
            const icon = iconPics.get(iconName);
            if (icon) {
                // X=10 matches WEAPON_ICON_X in layout.ts
                renderer.drawPic(HUD_LAYOUT.WEAPON_ICON_X, keyY, icon);
                keyY += icon.height + 2;
            }
        }
    }
};
