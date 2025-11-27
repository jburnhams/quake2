import { AssetManager, Pic, Renderer } from '@quake2ts/engine';

/**
 * Global map of loaded HUD icons.
 * This is imported and used by statusbar.ts for rendering.
 */
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

/**
 * Initialize and precache all HUD icon images.
 * Called during level load via CG_TouchPics().
 */
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
