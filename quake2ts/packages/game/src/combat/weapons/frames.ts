// =================================================================
// Quake II - Weapon Frame Definitions
// =================================================================

// Hand Grenade
// Source: p_weapon.cpp:1215-1224
export const FRAME_GRENADE_IDLE_FIRST = 16;
export const FRAME_GRENADE_IDLE_LAST  = 48;
export const FRAME_GRENADE_THROW_FIRST = 5;
export const FRAME_GRENADE_THROW_LAST = 15;
export const FRAME_GRENADE_PRIME_SOUND = 5;
export const FRAME_GRENADE_THROW_HOLD = 11;
export const FRAME_GRENADE_THROW_FIRE = 12;

// Shotgun
// Source: p_weapon.cpp:1684-1725
export const FRAME_SHOTGUN_ACTIVATE_LAST = 7;
export const FRAME_SHOTGUN_FIRE_LAST = 18;
export const FRAME_SHOTGUN_IDLE_LAST = 36;
export const FRAME_SHOTGUN_DEACTIVATE_LAST = 39;
// pause_frames = {22, 28, 34}
// fire_frames = {8, 9}

// Super Shotgun
// Source: p_weapon.cpp:1727-1781
export const FRAME_SSHOTGUN_ACTIVATE_LAST = 5;
export const FRAME_SSHOTGUN_FIRE_LAST = 28;
export const FRAME_SSHOTGUN_IDLE_LAST = 52;
export const FRAME_SSHOTGUN_DEACTIVATE_LAST = 57;
// pause_frames = {29, 42, 57} (Note: 57 is deactivate last, so maybe 57 not pause?)
// fire_frames = {22, 28}

// Machinegun
// Source: p_weapon.cpp:1594-1682
export const FRAME_MACHINEGUN_ACTIVATE_LAST = 3;
export const FRAME_MACHINEGUN_FIRE_LAST = 23;
export const FRAME_MACHINEGUN_IDLE_LAST = 52;
export const FRAME_MACHINEGUN_DEACTIVATE_LAST = 61;
// pause_frames = {23, 45}
// fire_frames = {4, 5, 30, 31}
// Re-reading p_weapon.cpp for machinegun...

// Chaingun
// Source: p_weapon.cpp:1546-1592
export const FRAME_CHAINGUN_ACTIVATE_LAST = 4; // actually fire_frame - 1 = 5 - 1
export const FRAME_CHAINGUN_FIRE_FRAME = 5;
export const FRAME_CHAINGUN_FIRE_LAST = 21;
export const FRAME_CHAINGUN_IDLE_LAST = 52;
export const FRAME_CHAINGUN_DEACTIVATE_LAST = 61; // pause frame?
export const FRAME_CHAINGUN_SPINUP = 5; // Frames 5-21 are fire loop

// Railgun
// Source: p_weapon.cpp:1783-1838
export const FRAME_RAILGUN_ACTIVATE_LAST = 3;
export const FRAME_RAILGUN_FIRE_LAST = 18;
export const FRAME_RAILGUN_IDLE_LAST = 51;
export const FRAME_RAILGUN_DEACTIVATE_LAST = 56;
// pause_frames = {56} (Deactivate last?)
// fire_frames = {4}

// Rocket Launcher
// Source: p_weapon.cpp:1280-1335
export const FRAME_ROCKET_ACTIVATE_LAST = 3;
export const FRAME_ROCKET_FIRE_LAST = 12;
export const FRAME_ROCKET_IDLE_LAST = 34;
export const FRAME_ROCKET_DEACTIVATE_LAST = 38;
// pause_frames = {25, 33}
// fire_frames = {4}

// HyperBlaster
// Source: p_weapon.cpp:1416-1460
export const FRAME_HYPERBLASTER_ACTIVATE_LAST = 5;
export const FRAME_HYPERBLASTER_FIRE_FRAME = 6;
export const FRAME_HYPERBLASTER_FIRE_LAST = 9;
export const FRAME_HYPERBLASTER_IDLE_LAST = 28;
export const FRAME_HYPERBLASTER_DEACTIVATE_LAST = 32;

// BFG10K
// Source: p_weapon.cpp:1840-1897
export const FRAME_BFG_ACTIVATE_LAST = 8;
export const FRAME_BFG_FIRE_LAST = 32;
export const FRAME_BFG_IDLE_LAST = 54;
export const FRAME_BFG_DEACTIVATE_LAST = 58;
// pause_frames = {39, 45, 50, 54}
// fire_frames = {9, 22} (Prime at 9, Fire at 22?)
// BFG logic is complex.

// Grenade Launcher
// Source: p_weapon.cpp:1234-1278
export const FRAME_GRENADELAUNCHER_ACTIVATE_LAST = 5;
export const FRAME_GRENADELAUNCHER_FIRE_LAST = 16;
export const FRAME_GRENADELAUNCHER_IDLE_LAST = 36;
export const FRAME_GRENADELAUNCHER_DEACTIVATE_LAST = 39;
// pause_frames = {34}
// fire_frames = {6}
