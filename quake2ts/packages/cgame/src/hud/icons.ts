import { CGameImport } from '../types.js';

/**
 * Global map of loaded HUD icons.
 * This is imported and used by statusbar.ts for rendering.
 */
export const iconPics = new Map<string, unknown>();

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

/**
 * Initialize and precache all HUD icon images.
 * Called during level load via CG_TouchPics().
 */
export const Init_Icons = (cgi: CGameImport) => {
    for (const name of ICON_NAMES) {
        try {
            const pic = cgi.Draw_RegisterPic(`pics/${name}.pcx`);
            iconPics.set(name, pic);
        } catch (e) {
            cgi.Com_Print(`Failed to load HUD image: pics/${name}.pcx\n`);
        }
    }
};
