import { ReplaySession, ReplayFrame } from './schema.js';
import { UserCommand } from '../protocol/usercmd.js';

export function serializeReplay(session: ReplaySession): string {
    return JSON.stringify(session, null, 2);
}

export function deserializeReplay(json: string): ReplaySession {
    const session = JSON.parse(json);

    // Validate structure lightly
    if (!session.metadata || !Array.isArray(session.frames)) {
        throw new Error('Invalid replay format: missing metadata or frames');
    }

    return session as ReplaySession;
}

export function createReplaySession(map: string, seed?: number): ReplaySession {
    return {
        metadata: {
            map,
            date: new Date().toISOString(),
            version: '1.0',
            seed
        },
        frames: []
    };
}

export function addReplayFrame(session: ReplaySession, cmd: UserCommand, serverFrame: number, startTime: number) {
    session.frames.push({
        serverFrame,
        cmd,
        timestamp: Date.now() - startTime
    });
}
