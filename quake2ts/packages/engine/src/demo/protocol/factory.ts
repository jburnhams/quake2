
import { ProtocolHandler } from './types.js';
import { Quake2ProtocolHandler } from './quake2.js';
import { RereleaseProtocolHandler, PROTOCOL_VERSION_RERELEASE } from './rerelease.js';
import { LegacyProtocolHandler } from './legacy.js';
import { ServerCommand } from '@quake2ts/shared';
import { EntityState, ProtocolPlayerState } from '../parser.js';
import { StreamingBuffer } from '../../stream/streamingBuffer.js';

export class BootstrapProtocolHandler implements ProtocolHandler {
    protocolVersion = 0;

    // We assume standard Q2 opcodes for bootstrap to find serverdata
    // but we can also check for legacy serverdata (12 vs 13 vs 7)
    translateCommand(cmd: number): ServerCommand {
        if (cmd === 7) return ServerCommand.serverdata;
        if (cmd === 12) return ServerCommand.serverdata; // Legacy Q2TS
        if (cmd === 13) return ServerCommand.serverdata; // Standard Q2
        return ServerCommand.bad;
    }

    parseServerData(stream: StreamingBuffer) {
        // We peek/read to detect protocol, then subsequent logic handles full read
        // But parseServerData is called AFTER translateCommand returned serverdata.
        // We need to read enough to determine version.

        // This method shouldn't really be called directly for full parsing
        // because we want to switch handlers.
        // But NetworkMessageParser calls this.

        const protocol = stream.readLong();

        // Reset stream position? No, we consume it.
        // But we need to return the data structure.
        // The structure depends on protocol.

        if (protocol === PROTOCOL_VERSION_RERELEASE) {
            // Rerelease structure
            const spawnCount = stream.readLong();
            const demoType = stream.readByte();
            const tickRate = stream.readByte();
            const gameDir = stream.readString();
            let playerNum = stream.readShort();
            if (playerNum === -2) {
                 const numSplits = stream.readShort();
                 for (let i = 0; i < numSplits; i++) stream.readShort();
                 playerNum = 0;
            } else if (playerNum === -1) {
                playerNum = -1;
            }
            const levelName = stream.readString();
            return {
                protocol,
                serverCount: spawnCount,
                spawnCount,
                attractLoop: 0,
                gameDir,
                playerNum,
                levelName,
                tickRate,
                demoType
            };
        } else {
            // Standard/Legacy structure
            const serverCount = stream.readLong();
            const attractLoop = stream.readByte();
            const gameDir = stream.readString();
            const playerNum = stream.readShort();
            const levelName = stream.readString();
            return {
                protocol,
                serverCount,
                attractLoop,
                gameDir,
                playerNum,
                levelName
            };
        }
    }

    parseEntityBits(stream: StreamingBuffer): { number: number; bits: number; bitsHigh: number } {
        throw new Error("Bootstrap handler cannot parse entities");
    }

    parseDelta(from: EntityState, to: EntityState, number: number, bits: number, bitsHigh: number, stream: StreamingBuffer): void {
        throw new Error("Bootstrap handler cannot parse delta");
    }

    parsePlayerState(stream: StreamingBuffer): ProtocolPlayerState {
        throw new Error("Bootstrap handler cannot parse player state");
    }
}

export function createProtocolHandler(version: number): ProtocolHandler {
    if (version === PROTOCOL_VERSION_RERELEASE) {
        return new RereleaseProtocolHandler();
    }
    if (version === 34) {
        return new Quake2ProtocolHandler();
    }
    // Default to Legacy for 0 or older versions if not strictly 34/2023?
    // Or default to Legacy for now to support existing tests/demos.
    return new LegacyProtocolHandler(version);
}
