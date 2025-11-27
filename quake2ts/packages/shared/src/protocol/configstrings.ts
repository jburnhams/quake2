// Mirrors the Quake II rerelease configstring/index layout from `game.h`.
// These constants intentionally track the numeric values used in the C++
// game and client modules so the TypeScript engine/game/client layers can
// share deterministic indices for precaches and HUD parsing.

export const MAX_STRING_CHARS = 1024;
export const MAX_STRING_TOKENS = 80;
export const MAX_TOKEN_CHARS = 512;

export const MAX_QPATH = 64;
export const MAX_OSPATH = 128;

export const MAX_CLIENTS = 256;
export const MAX_EDICTS = 8192;
export const MAX_LIGHTSTYLES = 256;
export const MAX_MODELS = 8192;
export const MAX_SOUNDS = 2048;
export const MAX_IMAGES = 512;
export const MAX_ITEMS = 256;
export const MAX_GENERAL = MAX_CLIENTS * 2;
export const MAX_SHADOW_LIGHTS = 256;
export const MAX_WHEEL_ITEMS = 32;

export const CS_MAX_STRING_LENGTH = 96;
export const CS_MAX_STRING_LENGTH_OLD = 64;

// Enum-style numeric constants that mirror the C++ `configstrings` enum. Only
// the explicitly numbered entries are re-stated here; everything else follows
// sequentially to keep the arithmetic (e.g., CS_SOUNDS = CS_MODELS +
// MAX_MODELS) intact.
export enum ConfigStringIndex {
  Name = 0,
  CdTrack = 1,
  Sky = 2,
  SkyAxis = 3,
  SkyRotate = 4,
  StatusBar = 5,

  // Matching bg_local.h:55-76
  CONFIG_N64_PHYSICS = 56,
  CONFIG_CTF_TEAMS = 57,
  CONFIG_COOP_RESPAWN_STRING = 58,

  AirAccel = 59,
  MaxClients = 60,
  MapChecksum = 61,

  Models = 62,
  Sounds = Models + MAX_MODELS,
  Images = Sounds + MAX_SOUNDS,
  Lights = Images + MAX_IMAGES,
  ShadowLights = Lights + MAX_LIGHTSTYLES,
  Items = ShadowLights + MAX_SHADOW_LIGHTS,
  PlayerSkins = Items + MAX_ITEMS,
  General = PlayerSkins + MAX_CLIENTS,
  WheelWeapons = General + MAX_GENERAL,
  WheelAmmo = WheelWeapons + MAX_WHEEL_ITEMS,
  WheelPowerups = WheelAmmo + MAX_WHEEL_ITEMS,
  CdLoopCount = WheelPowerups + MAX_WHEEL_ITEMS,
  GameStyle = CdLoopCount + 1,
  MaxConfigStrings = GameStyle + 1,
}

// Mirror the C++ MAX_CONFIGSTRINGS value for consumers that prefer a standalone constant.
export const MAX_CONFIGSTRINGS = ConfigStringIndex.MaxConfigStrings;

/**
 * Returns the maximum string length permitted for the given configstring index,
 * mirroring the `CS_SIZE` helper in the rerelease. Statusbar and general ranges
 * can legally occupy multiple 96-character slots; everything else is capped at
 * `CS_MAX_STRING_LENGTH`.
 */
export function configStringSize(index: number): number {
  if (index >= ConfigStringIndex.StatusBar && index < ConfigStringIndex.AirAccel) {
    return CS_MAX_STRING_LENGTH * (ConfigStringIndex.AirAccel - index);
  }

  if (index >= ConfigStringIndex.General && index < ConfigStringIndex.WheelWeapons) {
    return CS_MAX_STRING_LENGTH * (ConfigStringIndex.MaxConfigStrings - index);
  }

  return CS_MAX_STRING_LENGTH;
}
