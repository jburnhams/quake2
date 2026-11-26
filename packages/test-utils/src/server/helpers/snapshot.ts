import { Server } from '@quake2ts/server';
import { EntityState, BinaryStream, ProtocolPlayerState } from '@quake2ts/shared';

export interface Snapshot {
    serverTime: number;
    playerState: any; // Simplified PlayerState
    entities: EntityState[];
}

export interface DeltaSnapshot {
    snapshot: Snapshot;
    deltaEntities: EntityState[];
    removedEntities: number[];
}

export interface ConsistencyReport {
    valid: boolean;
    errors: string[];
}

/**
 * Creates a client-specific snapshot from the server state.
 * @param serverState The current server state.
 * @param clientNum The client number to generate snapshot for.
 */
export function createServerSnapshot(serverState: Server, clientNum: number): Snapshot {
    // Collect visible entities
    const visibleEntities: EntityState[] = [];

    // In a real implementation, this would use PVS/PHS
    // For mock, we just take all entities that have a model or are solid
    if (serverState.baselines) {
        serverState.baselines.forEach((ent: EntityState | null, index: number) => {
            if (ent && index !== clientNum + 1) { // Skip self in packet entities usually
                visibleEntities.push({ ...ent });
            }
        });
    }

    return {
        serverTime: serverState.time,
        playerState: {
            origin: { x: 0, y: 0, z: 0 },
            viewangles: { x: 0, y: 0, z: 0 },
            pm_type: 0
        },
        entities: visibleEntities
    };
}

/**
 * Calculates the delta between two snapshots.
 * @param oldSnapshot The baseline snapshot.
 * @param newSnapshot The current snapshot.
 */
export function createDeltaSnapshot(oldSnapshot: Snapshot, newSnapshot: Snapshot): DeltaSnapshot {
    const deltaEntities: EntityState[] = [];
    const removedEntities: number[] = [];

    const oldMap = new Map(oldSnapshot.entities.map(e => [e.number, e]));
    const newMap = new Map(newSnapshot.entities.map(e => [e.number, e]));

    // Find changed or new entities
    newSnapshot.entities.forEach(newEnt => {
        const oldEnt = oldMap.get(newEnt.number);
        if (!oldEnt) {
            // New entity
            deltaEntities.push(newEnt);
        } else if (JSON.stringify(newEnt) !== JSON.stringify(oldEnt)) {
            // Changed entity (simplified check)
            deltaEntities.push(newEnt);
        }
    });

    // Find removed entities
    oldSnapshot.entities.forEach(oldEnt => {
        if (!newMap.has(oldEnt.number)) {
            removedEntities.push(oldEnt.number);
        }
    });

    return {
        snapshot: newSnapshot,
        deltaEntities,
        removedEntities
    };
}

/**
 * Verifies the consistency of a sequence of snapshots.
 * @param snapshots Array of snapshots ordered by time.
 */
export function verifySnapshotConsistency(snapshots: Snapshot[]): ConsistencyReport {
    const report: ConsistencyReport = { valid: true, errors: [] };

    if (snapshots.length < 2) return report;

    for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i-1];
        const curr = snapshots[i];

        if (curr.serverTime <= prev.serverTime) {
            report.valid = false;
            report.errors.push(`Snapshot ${i} has time ${curr.serverTime} <= prev ${prev.serverTime}`);
        }
    }

    return report;
}

/**
 * Simulates network delivery of a snapshot with potential packet loss.
 * @param snapshot The snapshot to deliver.
 * @param reliability Probability of successful delivery (0.0 to 1.0).
 */
export async function simulateSnapshotDelivery(snapshot: Snapshot, reliability: number = 1.0): Promise<Snapshot | null> {
    if (Math.random() > reliability) {
        return null;
    }
    return snapshot;
}

/**
 * Parses a ProtocolPlayerState from a binary buffer.
 * Useful for testing player state serialization.
 * logic adapted from packages/engine/src/demo/parser.ts
 * @param data The binary data to parse.
 */
export function parseProtocolPlayerState(data: Uint8Array): ProtocolPlayerState {
    const stream = new BinaryStream(data.buffer as ArrayBuffer);
    const ps: ProtocolPlayerState = {
        pm_type: 0,
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        pm_time: 0,
        pm_flags: 0,
        gravity: 0,
        delta_angles: { x: 0, y: 0, z: 0 },
        viewoffset: { x: 0, y: 0, z: 0 },
        viewangles: { x: 0, y: 0, z: 0 },
        kick_angles: { x: 0, y: 0, z: 0 },
        gun_index: 0,
        gun_frame: 0,
        gun_offset: { x: 0, y: 0, z: 0 },
        gun_angles: { x: 0, y: 0, z: 0 },
        blend: [0, 0, 0, 0],
        fov: 0,
        rdflags: 0,
        stats: new Array(32).fill(0),
        watertype: 0
    };

    const flags = stream.readShort();

    if (flags & 1) ps.pm_type = stream.readByte();

    if (flags & 2) {
        const x = stream.readShort() * 0.125;
        const y = stream.readShort() * 0.125;
        const z = stream.readShort() * 0.125;
        ps.origin = { x, y, z };
    }

    if (flags & 4) {
        const x = stream.readShort() * 0.125;
        const y = stream.readShort() * 0.125;
        const z = stream.readShort() * 0.125;
        ps.velocity = { x, y, z };
    }

    if (flags & 8) ps.pm_time = stream.readByte();
    if (flags & 16) ps.pm_flags = stream.readByte();
    if (flags & 32) ps.gravity = stream.readShort();

    if (flags & 64) {
        const x = stream.readShort() * (180 / 32768);
        const y = stream.readShort() * (180 / 32768);
        const z = stream.readShort() * (180 / 32768);
        ps.delta_angles = { x, y, z };
    }

    if (flags & 128) {
        const x = stream.readChar() * 0.25;
        const y = stream.readChar() * 0.25;
        const z = stream.readChar() * 0.25;
        ps.viewoffset = { x, y, z };
    }

    if (flags & 256) {
        const x = stream.readAngle16();
        const y = stream.readAngle16();
        const z = stream.readAngle16();
        ps.viewangles = { x, y, z };
    }

    if (flags & 512) {
        const x = stream.readChar() * 0.25;
        const y = stream.readChar() * 0.25;
        const z = stream.readChar() * 0.25;
        ps.kick_angles = { x, y, z };
    }

    if (flags & 4096) ps.gun_index = stream.readByte();

    if (flags & 8192) {
        ps.gun_frame = stream.readByte();
        const ox = stream.readChar() * 0.25;
        const oy = stream.readChar() * 0.25;
        const oz = stream.readChar() * 0.25;
        ps.gun_offset = { x: ox, y: oy, z: oz };

        const ax = stream.readChar() * 0.25;
        const ay = stream.readChar() * 0.25;
        const az = stream.readChar() * 0.25;
        ps.gun_angles = { x: ax, y: ay, z: az };
    }

    if (flags & 1024) {
        ps.blend = [
            stream.readByte(),
            stream.readByte(),
            stream.readByte(),
            stream.readByte()
        ];
    }

    if (flags & 2048) ps.fov = stream.readByte();
    if (flags & 16384) ps.rdflags = stream.readByte();

    // New: watertype (bit 15)
    if (flags & 32768) ps.watertype = stream.readByte();

    const statbits = stream.readLong();
    for (let i = 0; i < 32; i++) {
        if (statbits & (1 << i)) {
            ps.stats[i] = stream.readShort();
        }
    }

    return ps;
}
