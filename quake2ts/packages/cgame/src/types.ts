import type { Vec3 } from '@quake2ts/shared/math/vec3.js';
import type { PlayerState } from '@quake2ts/shared/protocol/player-state.js';
import type { PmoveCmd, PmoveTraceResult } from '@quake2ts/shared/pmove/types.js';
import type { LayoutFlags } from '@quake2ts/shared/protocol/layout.js';

/**
 * Interface provided by the Engine to the CGame module.
 * Mirrors `cgame_import_t` from `rerelease/game.h`.
 */
export interface CGameImport {
  // Frame timing
  tick_rate: number;
  frame_time_s: number;
  frame_time_ms: number;

  // Console
  Com_Print(msg: string): void;
  Com_Error(msg: string): void;

  // Config strings
  get_configstring(num: number): string;

  // Memory (Simplified in TS, but kept for interface parity if needed)
  TagMalloc(size: number, tag: number): unknown;
  TagFree(ptr: unknown): void;
  FreeTags(tag: number): void;

  // Cvars
  cvar(name: string, value: string, flags: number): unknown; // simplified type
  cvar_set(name: string, value: string): void;
  cvar_forceset(name: string, value: string): void;

  // Client state
  CL_FrameValid(): boolean;
  CL_FrameTime(): number;
  CL_ClientTime(): number;
  CL_ServerFrame(): number;
  CL_ServerProtocol(): number;

  // Client info
  CL_GetClientName(playerNum: number): string;
  CL_GetClientPic(playerNum: number): string;
  CL_GetClientDogtag(playerNum: number): string;
  CL_GetKeyBinding(key: string): string;

  // Drawing
  Draw_RegisterPic(name: string): unknown; // Returns handle/object
  Draw_GetPicSize(pic: unknown): { width: number, height: number };
  SCR_DrawChar(x: number, y: number, char: number): void;
  SCR_DrawPic(x: number, y: number, pic: unknown): void;
  SCR_DrawColorPic(x: number, y: number, pic: unknown, color: Vec3, alpha: number): void; // assuming vec3 color
  SCR_DrawFontString(x: number, y: number, str: string): void;
  SCR_MeasureFontString(str: string): number;
  SCR_FontLineHeight(): number;
  SCR_SetAltTypeface(alt: boolean): void;
  SCR_DrawBind(x: number, y: number, command: string): void;

  // Localization
  Localize(key: string): string;

  // State queries
  CL_GetTextInput(): string;
  CL_GetWarnAmmoCount(): number;
  CL_InAutoDemoLoop(): boolean;

  // Prediction Trace (added as per Phase 3 requirements)
  PM_Trace(start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3): PmoveTraceResult;
}

/**
 * Interface exported by the CGame module to the Engine.
 * Mirrors `cgame_export_t` from `rerelease/game.h`.
 */
export interface CGameExport {
  // Lifecycle
  Init(): void;
  Shutdown(): void;

  // Rendering
  DrawHUD(
    isplit: number,
    data: unknown, // Placeholder, likely specific HUD data structure
    hud_vrect: { x: number, y: number, width: number, height: number },
    hud_safe: { x: number, y: number, width: number, height: number },
    scale: number,
    playernum: number,
    ps: PlayerState
  ): void;

  // Asset loading
  TouchPics(): void;

  // Layout flags
  LayoutFlags(ps: PlayerState): LayoutFlags;

  // Weapon wheel
  GetActiveWeaponWheelWeapon(ps: PlayerState): number;
  GetOwnedWeaponWheelWeapons(ps: PlayerState): number[];
  GetWeaponWheelAmmoCount(ps: PlayerState, weapon: number): number;
  GetPowerupWheelCount(ps: PlayerState): number;

  // Hit markers
  GetHitMarkerDamage(ps: PlayerState): number;

  // Prediction
  Pmove(pmove: unknown): void; // Should match Pmove signature from shared

  // Parsing
  ParseConfigString(i: number, s: string): void;
  ParseCenterPrint(str: string, isplit: number, instant: boolean): void;
  NotifyMessage(isplit: number, msg: string, is_chat: boolean): void;

  // State management
  ClearNotify(isplit: number): void;
  ClearCenterprint(isplit: number): void;

  // Effects
  GetMonsterFlashOffset(id: number): Vec3;

  // Extension
  GetExtension(name: string): unknown;
}
