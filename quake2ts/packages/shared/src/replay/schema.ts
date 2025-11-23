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

    /**
     * The hash of the game state AFTER this frame was executed.
     * Optional for backward compatibility or lightweight recording.
     */
    stateHash?: number;
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
        gravity?: { x: number, y: number, z: number }; // Capture gravity
    };

    /**
     * The sequence of inputs.
     */
    frames: ReplayFrame[];
}
