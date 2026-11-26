import { Replay } from '@quake2ts/shared';
import { GameExports, hashEntitySystem, createGame, GameEngine, GameImports } from '../index.js';
import { Vec3 } from '@quake2ts/shared';

export interface ReplayResult {
    success: boolean;
    errorFrame?: number;
    expectedHash?: number;
    actualHash?: number;
    message?: string;
}

export class GameReplayer {
    private session: Replay.ReplaySession;

    constructor(session: Replay.ReplaySession) {
        this.session = session;
    }

    run(imports: GameImports, engine: GameEngine): ReplayResult {
        const gravity = (this.session.metadata.gravity as Vec3) || { x: 0, y: 0, z: -800 };

        const game = createGame(imports, engine, {
            gravity: gravity
        });

        game.init(0);

        // Spawn world if map loading was simulated or if we need to set up entities
        // In a real scenario, we would load the map first.
        // For unit tests, we might just spawn world.
        game.spawnWorld();

        // We assume frame 0 is initialization.
        // Replay frames usually start from 1 or when the user takes control.

        for (const frameData of this.session.frames) {
            const { serverFrame, cmd, timestamp, stateHash } = frameData;

            const deltaMs = cmd.msec;
            const nowMs = timestamp;

            game.frame({
                frame: serverFrame,
                deltaMs: deltaMs,
                nowMs: nowMs
            }, cmd);

            if (stateHash !== undefined) {
                const currentSnapshot = game.entities.createSnapshot();
                const currentHash = hashEntitySystem(currentSnapshot);

                if (currentHash !== stateHash) {
                    return {
                        success: false,
                        errorFrame: serverFrame,
                        expectedHash: stateHash,
                        actualHash: currentHash,
                        message: `State divergence at frame ${serverFrame}`
                    };
                }
            }
        }

        return { success: true };
    }
}
