import { describe, it, expect } from 'vitest';
import {
    createServerSnapshot,
    createDeltaSnapshot,
    verifySnapshotConsistency,
    Snapshot
} from '../../src/server/helpers/snapshot';
import { createMockServerState } from '../../src/server/mocks/state';
import { EntityState } from '@quake2ts/shared';

describe('Snapshot Helpers', () => {
    describe('createServerSnapshot', () => {
        it('should create snapshot from server state', () => {
            const state = createMockServerState();
            state.time = 100;

            // Add some entities to baselines
            const ent1: EntityState = { number: 1, origin: {x:0,y:0,z:0} } as any;
            const ent2: EntityState = { number: 2, origin: {x:10,y:0,z:0} } as any;
            state.baselines[1] = ent1;
            state.baselines[2] = ent2;

            // Generate snapshot for client 0 (ent 1)
            const snapshot = createServerSnapshot(state, 0);

            expect(snapshot.serverTime).toBe(100);
            expect(snapshot.entities.length).toBe(1);
            expect(snapshot.entities[0].number).toBe(2); // Should only see other entities
        });
    });

    describe('createDeltaSnapshot', () => {
        it('should identify new and changed entities', () => {
            const oldSnapshot: Snapshot = {
                serverTime: 100,
                playerState: {},
                entities: [
                    { number: 2, origin: {x:0,y:0,z:0} } as any
                ]
            };

            const newSnapshot: Snapshot = {
                serverTime: 110,
                playerState: {},
                entities: [
                    { number: 2, origin: {x:10,y:0,z:0} } as any, // Changed
                    { number: 3, origin: {x:50,y:0,z:0} } as any  // New
                ]
            };

            const delta = createDeltaSnapshot(oldSnapshot, newSnapshot);

            expect(delta.deltaEntities.length).toBe(2);
            expect(delta.removedEntities.length).toBe(0);
        });

        it('should identify removed entities', () => {
            const oldSnapshot: Snapshot = {
                serverTime: 100,
                playerState: {},
                entities: [
                    { number: 2, origin: {x:0,y:0,z:0} } as any
                ]
            };

            const newSnapshot: Snapshot = {
                serverTime: 110,
                playerState: {},
                entities: []
            };

            const delta = createDeltaSnapshot(oldSnapshot, newSnapshot);

            expect(delta.deltaEntities.length).toBe(0);
            expect(delta.removedEntities).toContain(2);
        });
    });

    describe('verifySnapshotConsistency', () => {
        it('should pass for ordered snapshots', () => {
            const snapshots: Snapshot[] = [
                { serverTime: 100, entities: [], playerState: {} },
                { serverTime: 110, entities: [], playerState: {} }
            ];

            const report = verifySnapshotConsistency(snapshots);
            expect(report.valid).toBe(true);
        });

        it('should fail for out-of-order snapshots', () => {
             const snapshots: Snapshot[] = [
                { serverTime: 110, entities: [], playerState: {} },
                { serverTime: 100, entities: [], playerState: {} }
            ];

            const report = verifySnapshotConsistency(snapshots);
            expect(report.valid).toBe(false);
            expect(report.errors.length).toBeGreaterThan(0);
        });
    });
});
