import type { Vec3, CollisionPlane } from '@quake2ts/shared';
import type { Entity } from './entities/entity.js';
import type { ServerCommand } from '@quake2ts/shared';

export interface GameTraceResult {
  allsolid: boolean;
  startsolid: boolean;
  fraction: number;
  endpos: Vec3;
  plane: CollisionPlane | null;
  surfaceFlags: number;
  contents: number;
  ent: Entity | null;
}

export type TraceFunction = (
  start: Vec3,
  mins: Vec3 | null,
  maxs: Vec3 | null,
  end: Vec3,
  passent: Entity | null,
  contentmask: number
) => GameTraceResult;

export type PointContentsFunction = (point: Vec3) => number;

export enum MulticastType {
  All = 0,
  Pvs = 1,
  Phs = 2,
}

export interface GameImports {
  trace: TraceFunction;

  pointcontents: PointContentsFunction;

  linkentity(ent: Entity): void;

  areaEdicts(mins: Vec3, maxs: Vec3): number[] | null;

  multicast(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void;
  unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void;

  configstring(index: number, value: string): void;
  serverCommand(cmd: string): void;
}

export interface GameEngine {
    trace(start: Vec3, end: Vec3): unknown;
    sound?(entity: Entity, channel: number, sound: string, volume: number, attenuation: number, timeofs: number): void;
    soundIndex?(sound: string): number;
    centerprintf?(entity: Entity, message: string): void;
    modelIndex?(model: string): number;
    multicast?(origin: Vec3, type: MulticastType, event: ServerCommand, ...args: any[]): void;
    unicast?(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void;
    configstring?(index: number, value: string): void;
    serverCommand?(cmd: string): void;
    cvar?(name: string): { number: number; string: string; value: string } | undefined;
}
