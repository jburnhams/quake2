import { Replay } from '@quake2ts/shared';
import { UserCommand } from '@quake2ts/shared';
import { GameExports, hashEntitySystem } from '../index.js';

export class GameRecorder {
    private session: Replay.ReplaySession;
    private game: GameExports;
    private startTime: number;

    constructor(game: GameExports, mapName: string, gravity: { x: number, y: number, z: number }) {
        this.game = game;
        this.startTime = Date.now();
        this.session = {
            metadata: {
                map: mapName,
                date: new Date().toISOString(),
                version: '1.0',
                gravity: { ...gravity }
            },
            frames: []
        };
    }

    recordFrame(serverFrame: number, cmd: UserCommand, timeMs: number) {
        // We can optionally compute the hash here.
        // Note: computing full entity system hash might be slow, so maybe only do it for tests or keyframes.
        // For strict validation, we do it every frame.

        // Get snapshot from game
        const entitySnapshot = this.game.entities.createSnapshot();
        const stateHash = hashEntitySystem(entitySnapshot);

        this.session.frames.push({
            serverFrame,
            cmd,
            timestamp: timeMs,
            stateHash
        });
    }

    getSession(): Replay.ReplaySession {
        return this.session;
    }
}
