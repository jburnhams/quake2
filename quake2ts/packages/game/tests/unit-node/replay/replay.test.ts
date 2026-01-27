import { describe, expect, it } from 'vitest';
import { createGame } from '../../../src/index.js';
import { GameRecorder } from '../../../src/replay/recorder.js';
import { GameReplayer } from '../../../src/replay/player.js';
import { UserCommand } from '@quake2ts/shared';

const GRAVITY = { x: 0, y: 0, z: -800 } as const;

const mockEngine = {
  trace(start: typeof GRAVITY, end: typeof GRAVITY) {
    return { start, end, fraction: 1, allsolid: false, startsolid: false };
  },
  pointcontents() { return 0; },
  linkentity() { },
  multicast() { },
  unicast() { }
};

describe('Replay System', () => {
    it('should record and replay a session with perfect determinism', () => {
        // 1. Record a session
        const game1 = createGame(
            mockEngine as any,
            mockEngine as any,
            { gravity: GRAVITY }
        );
        game1.init(0);
        game1.spawnWorld();

        const recorder = new GameRecorder(game1, 'test_map', GRAVITY);

        // Simulate a few frames with changing inputs
        for (let i = 1; i <= 10; i++) {
            const cmd: UserCommand = {
                msec: 25,
                buttons: i % 2 === 0 ? 1 : 0, // Toggle attack button
                angles: { x: 0, y: i * 10, z: 0 },
                forwardmove: 200,
                sidemove: 0,
                upmove: 0,
                serverFrame: i
            };

            game1.frame({ frame: i, deltaMs: 25, nowMs: i * 25 }, cmd);
            recorder.recordFrame(i, cmd, i * 25);
        }

        const session = recorder.getSession();

        expect(session.frames.length).toBe(10);
        expect(session.frames[0].stateHash).toBeDefined();

        // 2. Replay the session
        const replayer = new GameReplayer(session);
        const result = replayer.run(mockEngine as any, mockEngine as any);

        expect(result.success).toBe(true);
    });

    it('should fail if state diverges', () => {
        // 1. Record a session
        const game1 = createGame(
            mockEngine as any,
            mockEngine as any,
            { gravity: GRAVITY }
        );
        game1.init(0);
        game1.spawnWorld();

        const recorder = new GameRecorder(game1, 'test_map', GRAVITY);

        // Record one frame
        const cmd: UserCommand = {
            msec: 25,
            buttons: 0,
            angles: { x: 0, y: 0, z: 0 },
            forwardmove: 200,
            sidemove: 0,
            upmove: 0,
            serverFrame: 1
        };
        game1.frame({ frame: 1, deltaMs: 25, nowMs: 25 }, cmd);
        recorder.recordFrame(1, cmd, 25);

        const session = recorder.getSession();

        // 2. Tamper with the hash in the session to simulate divergence
        session.frames[0].stateHash = (session.frames[0].stateHash || 0) + 1;

        // 3. Replay
        const replayer = new GameReplayer(session);
        const result = replayer.run(mockEngine as any, mockEngine as any);

        expect(result.success).toBe(false);
        expect(result.errorFrame).toBe(1);
    });

    it('should fail if inputs result in different state (tampered logic simulator)', () => {
         // 1. Record a session
         const game1 = createGame(
             mockEngine as any,
             mockEngine as any,
             { gravity: GRAVITY }
         );
         game1.init(0);
         game1.spawnWorld();

         const recorder = new GameRecorder(game1, 'test_map', GRAVITY);
         const cmd: UserCommand = {
             msec: 25,
             buttons: 0,
             angles: { x: 0, y: 0, z: 0 },
             forwardmove: 200,
             sidemove: 0,
             upmove: 0,
             serverFrame: 1
         };
         game1.frame({ frame: 1, deltaMs: 25, nowMs: 25 }, cmd);
         recorder.recordFrame(1, cmd, 25);

         const session = recorder.getSession();

         // 2. Replay with modified engine/gravity (simulate code change)
         // We pass a modified gravity to the replayer via session metadata override?
         // The replayer reads gravity from session metadata.
         // Let's modify the session metadata to have different gravity,
         // which should cause position divergence if the replayer uses it.

         session.metadata.gravity = { x: 0, y: 0, z: -200 }; // Different gravity

         const replayer = new GameReplayer(session);
         const result = replayer.run(mockEngine as any, mockEngine as any);

         expect(result.success).toBe(false);
    });
});
