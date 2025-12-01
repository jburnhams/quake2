/**
 * CGame Module Entry Point
 * Reference: rerelease/cg_main.cpp
 *
 * This module provides the GetCGameAPI() function that returns the cgame_export_t
 * interface to the client engine.
 */

import type { CGameImport, CGameExport, PmoveInfo } from './types.js';
import { PlayerState, Vec3, applyPmove, PmoveTraceResult } from '@quake2ts/shared';
import { LayoutFlags } from '@quake2ts/shared';
import { CG_InitScreen, CG_TouchPics, CG_DrawHUD, CG_GetMessageSystem, CG_GetSubtitleSystem } from './screen.js';
import { CG_ParseConfigString } from './parse.js';

export type { CGameImport, CGameExport } from './types.js';

// Re-export new modules
export * from './view/camera.js';
export * from './view/effects.js';
export * from './prediction/index.js';

// Module-level state
let cgi: CGameImport | null = null;

/**
 * Initialize the CGame module.
 * Reference: rerelease/cg_main.cpp InitCGame()
 */
function Init(): void {
    if (!cgi) {
        console.error('CGame Init: cgame imports not set');
        return;
    }

    cgi.Com_Print('===== CGame Initialization =====\n');

    // Initialize screen/HUD module
    CG_InitScreen(cgi);

    cgi.Com_Print('CGame initialized\n');
}

/**
 * Shutdown the CGame module.
 * Reference: rerelease/cg_main.cpp ShutdownCGame()
 */
function Shutdown(): void {
    if (cgi) {
        cgi.Com_Print('CGame shutdown\n');
    }
    cgi = null;
}

/**
 * Main HUD drawing function (wrapper for CG_DrawHUD).
 * Reference: rerelease/cg_screen.cpp CG_DrawHUD()
 */
function DrawHUD(
    isplit: number,
    data: unknown,
    hud_vrect: { x: number; y: number; width: number; height: number },
    hud_safe: { x: number; y: number; width: number; height: number },
    scale: number,
    playernum: number,
    ps: PlayerState
): void {
    CG_DrawHUD(isplit, data, hud_vrect, hud_safe, scale, playernum, ps);
}

/**
 * Precache all HUD images.
 * Reference: rerelease/cg_screen.cpp TouchPics()
 */
function TouchPics(): void {
    CG_TouchPics();
}

/**
 * Get layout flags for current player state.
 * Reference: rerelease/cg_screen.cpp
 */
function GetLayoutFlags(ps: PlayerState): LayoutFlags {
    // TODO: Implement proper layout flag calculation
    // Based on inventory state, help state, intermission, etc.
    return 0 as LayoutFlags; // No flags set by default
}

/**
 * Placeholder stubs for remaining CGameExport functions.
 * These will be implemented as needed.
 */

function GetActiveWeaponWheelWeapon(ps: PlayerState): number {
    return 0;
}

function GetOwnedWeaponWheelWeapons(ps: PlayerState): number[] {
    return [];
}

function GetWeaponWheelAmmoCount(ps: PlayerState, weapon: number): number {
    return 0;
}

function GetPowerupWheelCount(ps: PlayerState): number {
    return 0;
}

function GetHitMarkerDamage(ps: PlayerState): number {
    return 0;
}

/**
 * Pmove implementation for client-side prediction.
 * Calls the shared Pmove() function (applyPmove in TS port).
 *
 * @param pmove - PmoveInfo structure (similar to pmove_t)
 */
function Pmove(pmove: unknown): void {
    const pm = pmove as PmoveInfo;
    if (!pm || !pm.s || !pm.cmd || !cgi) {
        return;
    }

    // Adapter for PmoveTraceFn using CGameImport trace
    const traceAdapter = (start: Vec3, end: Vec3, mins?: Vec3, maxs?: Vec3): PmoveTraceResult => {
        // Shared PmoveTraceFn uses optional mins/maxs, CGameImport expects them.
        // If not provided, assume point trace (0,0,0)
        const zero: Vec3 = { x: 0, y: 0, z: 0 };
        return cgi!.PM_Trace(
            start,
            end,
            mins || zero,
            maxs || zero
        );
    };

    // Adapter for PmovePointContentsFn using CGameImport trace
    const pointContentsAdapter = (point: Vec3): number => {
        const zero: Vec3 = { x: 0, y: 0, z: 0 };
        // Perform a point trace to get contents
        const tr = cgi!.PM_Trace(point, point, zero, zero);
        return tr.contents || 0;
    };

    // Call shared Pmove implementation
    // This returns a NEW PlayerState, so we must update pm.s
    const newState = applyPmove(pm.s, pm.cmd, traceAdapter, pointContentsAdapter);

    // Update mutable state
    pm.s.origin = newState.origin;
    pm.s.velocity = newState.velocity;
    pm.s.onGround = newState.onGround;
    pm.s.waterLevel = newState.waterLevel;
    // applyPmove might update other fields in the future
}

function ParseConfigString(i: number, s: string): void {
    if (!cgi) return;
    CG_ParseConfigString(cgi, i, s);
}

function ParseCenterPrint(str: string, isplit: number, instant: boolean): void {
    if (!cgi) return;
    const messageSystem = CG_GetMessageSystem();
    // TODO: Parse layout strings and handle key bindings
    messageSystem.setCenterPrint(str, cgi.CL_ClientTime());
}

function NotifyMessage(isplit: number, msg: string, is_chat: boolean): void {
    if (!cgi) return;
    const messageSystem = CG_GetMessageSystem();
    messageSystem.addNotification(msg, is_chat, cgi.CL_ClientTime());
}

function ClearNotify(isplit: number): void {
    const messageSystem = CG_GetMessageSystem();
    messageSystem.clearNotifications();
}

function ClearCenterprint(isplit: number): void {
    const messageSystem = CG_GetMessageSystem();
    messageSystem.clearCenterPrint();
}

function ShowSubtitle(text: string, soundName: string): void {
  if (!cgi) return;
  const subtitleSystem = CG_GetSubtitleSystem();
  subtitleSystem.addSubtitle(text, cgi.CL_ClientTime());
}

function GetMonsterFlashOffset(id: number): Vec3 {
    return { x: 0, y: 0, z: 0 };
}

function GetExtension(name: string): unknown {
    return null;
}

/**
 * Main entry point for CGame module.
 * Reference: rerelease/cg_main.cpp GetCGameAPI()
 *
 * @param imports - Functions provided by the client engine
 * @returns CGame export interface
 */
export function GetCGameAPI(imports: CGameImport): CGameExport {
    cgi = imports;

    return {
        // Lifecycle
        Init,
        Shutdown,

        // Rendering
        DrawHUD,
        TouchPics,

        // Layout
        LayoutFlags: GetLayoutFlags,

        // Weapon wheel
        GetActiveWeaponWheelWeapon,
        GetOwnedWeaponWheelWeapons,
        GetWeaponWheelAmmoCount,
        GetPowerupWheelCount,

        // Hit markers
        GetHitMarkerDamage,

        // Prediction
        Pmove,

        // Parsing
        ParseConfigString,
        ParseCenterPrint,
        NotifyMessage,
        ShowSubtitle,

        // State management
        ClearNotify,
        ClearCenterprint,

        // Effects
        GetMonsterFlashOffset,

        // Extension
        GetExtension,
    };
}
