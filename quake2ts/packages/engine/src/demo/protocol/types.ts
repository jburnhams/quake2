
import { EntityState, ProtocolPlayerState, FrameData } from '../parser.js';
import { ServerCommand, Vec3 } from '@quake2ts/shared';
import { StreamingBuffer } from '../../stream/streamingBuffer.js';

export interface ProtocolHandler {
    protocolVersion: number;

    translateCommand(cmd: number): ServerCommand;

    parseServerData(stream: StreamingBuffer): {
        protocol: number;
        serverCount: number;
        attractLoop: number;
        gameDir: string;
        playerNum: number;
        levelName: string;
        tickRate?: number;
        demoType?: number;
        spawnCount?: number;
    };

    parseEntityBits(stream: StreamingBuffer): { number: number; bits: number; bitsHigh: number };

    parseDelta(
        from: EntityState,
        to: EntityState,
        number: number,
        bits: number,
        bitsHigh: number,
        stream: StreamingBuffer
    ): void;

    parsePlayerState(stream: StreamingBuffer): ProtocolPlayerState;
}
