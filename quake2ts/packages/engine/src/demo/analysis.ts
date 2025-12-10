import { EntityState, ProtocolPlayerState } from './parser.js';
import { Vec3 } from '@quake2ts/shared';

export interface FrameDiff {
    frameA: number;
    frameB: number;
    playerStateDiff: {
        origin: Vec3 | null; // null if same
        viewangles: Vec3 | null;
        health: number | null; // diff value
        ammo: number | null;
    };
    entityDiffs: {
        added: number[];
        removed: number[];
        moved: { id: number, delta: Vec3 }[];
    };
}

export enum DemoEventType {
    WeaponFire,
    DamageDealt,
    DamageReceived,
    Pickup,
    Death,
    Spawn,
    PlayerInfo // Name change, etc
}

export interface DemoEvent {
    type: DemoEventType;
    frame: number;
    time: number;
    entityId?: number;
    targetId?: number;
    value?: number; // Damage amount, weapon ID, etc.
    position?: Vec3;
    description?: string;
}

export interface EventSummary {
    totalKills: number;
    totalDeaths: number;
    damageDealt: number;
    damageReceived: number;
    weaponUsage: Map<number, number>; // WeaponID -> Count
}
