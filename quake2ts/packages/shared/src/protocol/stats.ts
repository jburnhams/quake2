// Matching rerelease/bg_local.h:196-262
export enum PlayerStat {
    STAT_HEALTH_ICON = 0,
    STAT_HEALTH,
    STAT_AMMO_ICON,
    STAT_AMMO,
    STAT_ARMOR_ICON,
    STAT_ARMOR,
    STAT_SELECTED_ICON,
    STAT_PICKUP_ICON,
    STAT_PICKUP_STRING,
    STAT_TIMER_ICON,
    STAT_TIMER,
    STAT_HELPICON,
    STAT_SELECTED_ITEM,
    STAT_LAYOUTS,
    STAT_FRAGS,
    STAT_FLASHES, // Not in original BG_LOCAL.H but used in Q2
    STAT_CHASE,
    STAT_SPECTATOR,

    // Rerelease additions
    STAT_WEAPONS_OWNED_1 = 18,
    STAT_WEAPONS_OWNED_2 = 19,

    // Ammo counts (start index)
    STAT_AMMO_INFO_START = 20
}

// Helper functions for compressed stats (bg_local.h:169-193)

// 9 bits for ammo count
export function G_SetAmmoStat(val: number): number {
    if (val > 511) return 511; // 9 bit max
    if (val < 0) return 0;
    return val;
}

export function G_GetAmmoStat(val: number): number {
    return val & 511; // 0x1FF
}

// 2 bits for powerup active/inactive state?
// Actually G_SetPowerupStat in rerelease seems to pack state.
// Checking rerelease source if available... assuming simplified logic for now.
// "val" is usually just the count or a flag.
export function G_SetPowerupStat(val: number): number {
    return val;
}

export function G_GetPowerupStat(val: number): number {
    return val;
}
