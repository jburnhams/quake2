import { Server } from '@quake2ts/server';
import { EntityState } from '@quake2ts/shared';

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
