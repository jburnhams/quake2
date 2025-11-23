import { UserCommand } from '../protocol/usercmd.js';

export interface ReplayFrame {
    /**
     * The server frame number this command was executed on.
     */
    serverFrame: number;

    /**
     * The command sent by the client.
     */
    cmd: UserCommand;

    /**
     * The timestamp (in ms) relative to start of recording.
     */
    timestamp: number;
}

export interface ReplaySession {
    /**
     * Metadata about the recording.
     */
    metadata: {
        map: string;
        date: string;
        version: string;
        seed?: number; // Random seed
    };

    /**
     * The sequence of inputs.
     */
    frames: ReplayFrame[];
}
