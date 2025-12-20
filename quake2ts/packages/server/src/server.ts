import { CollisionModel } from "@quake2ts/shared";
import { EntityState, MAX_CONFIGSTRINGS, MAX_EDICTS, MAX_CHALLENGES } from "@quake2ts/shared";
import { Client } from "./client.js";

/**
 * ServerState corresponds to server_state_t in the original source.
 */
export enum ServerState {
    Dead,           // no map loaded
    Loading,        // spawning level edicts
    Game,           // actively running
    Cinematic,
    Demo,
    Pic
}

export interface Challenge {
    adr: string; // IP address
    challenge: number;
    time: number;
}

/**
 * ServerStatic holds the state that is constant across server restarts.
 * Corresponds to server_static_t in the original source.
 */
export interface ServerStatic {
    initialized: boolean;
    realTime: number; // always increasing

    mapCmd: string;   // ie: *intro.cin+base

    spawnCount: number; // incremented each server start

    clients: (Client | null)[];

    // In original this is: entity_state_t *client_entities;
    // We might need a different approach in TS, but keeping the concept:
    // This buffer holds entity states for all clients history.
    // For now we might store it on the client directly or here.
    // Original: client_entities[maxclients*UPDATE_BACKUP*MAX_PACKET_ENTITIES]

    lastHeartbeat: number;

    challenges: Challenge[];

    // Demo recording stuff
    demoFile?: any; // File handle
}

/**
 * Server holds the state for the current running server instance.
 * Corresponds to server_t in the original source.
 */
export interface Server {
    state: ServerState;

    attractLoop: boolean;
    loadGame: boolean;

    startTime: number; // Added back as it was used in dedicated.ts and is useful
    time: number;       // sv.framenum * 100 msec
    frame: number;

    name: string;       // map name

    // Models are handled by AssetManager in engine usually,
    // but server needs collision models.
    collisionModel: CollisionModel | null;

    configStrings: string[]; // [MAX_CONFIGSTRINGS]
    baselines: (EntityState | null)[]; // [MAX_EDICTS]

    // Multicast buffer
    multicastBuf: Uint8Array;
}
