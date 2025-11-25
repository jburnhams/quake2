// This file contains the interfaces that define the contract between the engine and the cgame module.
// These are based on the original Quake II C source code, but adapted for TypeScript.
// Original source: full/game/game.h

import { PlayerState } from "../protocol/playerState";
import { UserCommand } from "../protocol/userCommand";
import { TraceResult } from "../bsp/trace";
import { Vec3 } from "../math/vec3";
import { mat4, vec3 } from 'gl-matrix';
import { WeaponId, PowerupId, KeyId } from "../game/items";
import { PmoveTraceFn, PmFlags, PmType, WaterLevel, DamageIndicator } from "@quake2ts/shared";

// --- Interfaces from @quake2ts/engine ---

export interface Pic {
    readonly width: number;
    readonly height: number;
}

export interface GpuProfilerStats {
    readonly gpuTimeMs: number;
}

export interface FrameRenderStats extends GpuProfilerStats {
    readonly fps: number;
    readonly drawCalls: number;
    readonly batches: number;
    readonly facesDrawn: number;
    readonly vertexCount: number;
}

export interface AssetManager {
    loadTexture: (path: string) => Promise<any>;
}

export interface Renderer {
    readonly width: number;
    readonly height: number;
    readonly stats: GpuProfilerStats;

    // Asset Methods
    registerTexture(name: string, texture: any): Pic;

    // HUD Methods
    begin2D(): void;
    end2D(): void;
    drawPic(x: number, y: number, pic: Pic, color?: [number, number, number, number]): void;
    drawString(x: number, y: number, text: string, color?: [number, number, number, number]): void;
    drawCenterString(y: number, text: string): void;
    drawfillRect(x: number, y: number, width: number, height: number, color: [number, number, number, number]): void;
}

export class Camera {
    position: vec3 = vec3.create();
    angles: vec3 = vec3.create(); // pitch, yaw, roll
    bobAngles: vec3 = vec3.create();
    bobOffset: vec3 = vec3.create();
    kickAngles: vec3 = vec3.create();
    rollAngle = 0;
    fov = 90;
    aspect = 1.0;
}

// --- Interfaces from @quake2ts/game ---

export interface AmmoInventory {
    readonly counts: readonly number[];
}

export interface RegularArmorState {
    readonly armorType: any;
    armorCount: number;
}

export interface PlayerInventory {
    readonly ammo: AmmoInventory;
    readonly ownedWeapons: Set<WeaponId>;
    currentWeapon?: WeaponId;
    armor: RegularArmorState | null;
    readonly powerups: Map<PowerupId, number | null>;
    readonly keys: Set<KeyId>;
    readonly items: Set<string>;
    pickupItem?: string;
    pickupTime?: number;
}

export interface WeaponState {
    lastFireTime: number;
    spinupCount?: number; // For Chaingun spin-up
}

export interface PlayerWeaponStates {
    states: Map<WeaponId, WeaponState>;
}

export interface PlayerClient {
    inventory: PlayerInventory;
    weaponStates: PlayerWeaponStates;
    kick_angles?: Vec3;
    kick_origin?: Vec3;
}

// --- CGame Interfaces ---

export interface PredictionState {
    readonly origin: Vec3;
    readonly velocity: Vec3;
    readonly viewangles: Vec3;
    readonly pmFlags: PmFlags;
    readonly pmType: PmType;
    readonly waterlevel: WaterLevel;
    readonly gravity: number;
    readonly deltaAngles?: Vec3;
    readonly client?: PlayerClient;
    readonly health: number;
    readonly armor: number;
    readonly ammo: number;
    readonly centerPrint?: string;
    readonly notify?: string;
    readonly blend: [number, number, number, number];
    readonly pickupIcon?: string;
    readonly damageAlpha: number;
    readonly damageIndicators: DamageIndicator[];
  }

export interface GameFrameResult<T> {
    frame: number;
    timeMs: number;
    state: T;
}

export interface CGameExports {
    Init: (imports: CGameImports) => void;
    Shutdown: () => void;
    DrawActiveFrame: (serverTime: number, stereoView: boolean, demoView: boolean, client: PlayerClient, ps: PlayerState, prediction: PredictionState, frameTimeMs: number) => void;
}

export interface CGameImports {
    // Renderer
    renderer: Renderer;
    assets: AssetManager;

    // Asset management
    modelindex: (name: string) => number;
    soundindex: (name: string) => number;
    imageindex: (name: string) => number;

    // collision detection
    trace: PmoveTraceFn;
    pointcontents: (point: Vec3) => number;

    // player movement
    Pmove: (pmove: any) => void;

    // console variables
    // cvar: (var_name: string, value: string, flags: number) => any;
    // cvar_set: (var_name: string, value: string) => any;
    // cvar_forceset: (var_name: string, value: string) => any;

    // command arguments
    argc: () => number;
    argv: (n: number) => string;
    args: () => string;

    // add commands to the server console as if they were typed in
    AddCommandString: (text: string) => void;
}
