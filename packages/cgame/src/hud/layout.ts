// Dynamic Layout Scaling
const REFERENCE_WIDTH = 640;
const REFERENCE_HEIGHT = 480;

export const getHudLayout = (width: number, height: number) => {
    // Determine scale factor - usually based on height to preserve aspect ratio logic or just scale uniform
    // Quake 2 typically scales 2D elements.
    const scaleX = width / REFERENCE_WIDTH;
    const scaleY = height / REFERENCE_HEIGHT;
    const scale = Math.min(scaleX, scaleY); // Uniform scaling

    // Or we can just center the 640x480 rect?
    // Modern approach: Scale UI to fit, or anchor to edges.
    // Let's implement edge anchoring logic relative to 640x480 coordinates.

    // Original constants (approximate):
    // HEALTH_X: 100, HEALTH_Y: 450
    // ARMOR_X: 200, ARMOR_Y: 450
    // AMMO_X: 540, AMMO_Y: 450
    // CENTER_PRINT: Center screen
    // WEAPON_ICON: Bottom left
    // POWERUP: Bottom right?

    // We'll return scaled coordinates.
    // For bottom elements, we should anchor to bottom.

    return {
        // Status bar numbers - Anchored Bottom-Left / Center / Right
        HEALTH_X: 100 * scale,
        HEALTH_Y: height - (REFERENCE_HEIGHT - 450) * scale,

        ARMOR_X: 200 * scale,
        ARMOR_Y: height - (REFERENCE_HEIGHT - 450) * scale,

        AMMO_X: width - (REFERENCE_WIDTH - 540) * scale, // Anchor right? 540 is near right (640)
        AMMO_Y: height - (REFERENCE_HEIGHT - 450) * scale,

        // Center print messages - Center
        CENTER_PRINT_X: width / 2,
        CENTER_PRINT_Y: 100 * scale, // Top anchor

        // Weapon and powerup icons
        WEAPON_ICON_X: 10 * scale,
        WEAPON_ICON_Y: height - (REFERENCE_HEIGHT - 450) * scale,

        POWERUP_X: width - (REFERENCE_WIDTH - 610) * scale,
        POWERUP_Y: height - (REFERENCE_HEIGHT - 450) * scale,

        scale: scale
    };
};

// Backward compatibility (deprecated, but useful for initial refactor)
export const HUD_LAYOUT = {
    HEALTH_X: 100,
    HEALTH_Y: 450,
    ARMOR_X: 200,
    ARMOR_Y: 450,
    AMMO_X: 540,
    AMMO_Y: 450,
    CENTER_PRINT_X: 320,
    CENTER_PRINT_Y: 100,
    WEAPON_ICON_X: 10,
    WEAPON_ICON_Y: 450,
    POWERUP_X: 610,
    POWERUP_Y: 450,
};
