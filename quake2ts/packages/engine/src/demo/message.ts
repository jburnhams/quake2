import { ServerCommand, Vec3 } from '@quake2ts/shared';
import { EntityState, FrameData, ProtocolPlayerState, FogData, DamageIndicator, NetworkMessageParser, NetworkMessageHandler } from './parser.js';
import { StreamingBuffer } from '../stream/streamingBuffer.js';
import { DemoReader } from './demoReader.js';

// Define Message Types matching ServerCommand

export interface BaseMessage {
    type: ServerCommand;
}

export interface ServerDataMessage extends BaseMessage {
    type: ServerCommand.serverdata;
    protocol: number;
    serverCount: number;
    attractLoop: number;
    gameDir: string;
    playerNum: number;
    levelName: string;
    tickRate?: number;
    demoType?: number;
}

export interface ConfigStringMessage extends BaseMessage {
    type: ServerCommand.configstring;
    index: number;
    string: string;
}

export interface SpawnBaselineMessage extends BaseMessage {
    type: ServerCommand.spawnbaseline;
    entity: EntityState;
}

export interface FrameMessage extends BaseMessage {
    type: ServerCommand.frame;
    data: FrameData;
}

export interface CenterPrintMessage extends BaseMessage {
    type: ServerCommand.centerprint;
    message: string;
}

export interface StuffTextMessage extends BaseMessage {
    type: ServerCommand.stufftext;
    text: string;
}

export interface PrintMessage extends BaseMessage {
    type: ServerCommand.print;
    level: number;
    message: string;
}

export interface SoundMessage extends BaseMessage {
    type: ServerCommand.sound;
    flags: number;
    soundNum: number;
    volume?: number;
    attenuation?: number;
    offset?: number;
    ent?: number;
    pos?: Vec3;
}

export interface TempEntityMessage extends BaseMessage {
    type: ServerCommand.temp_entity;
    tempType: number; // Renamed from 'type' to avoid conflict
    pos: Vec3;
    pos2?: Vec3;
    dir?: Vec3;
    cnt?: number;
    color?: number;
    ent?: number;
    srcEnt?: number;
    destEnt?: number;
}

export interface LayoutMessage extends BaseMessage {
    type: ServerCommand.layout;
    layout: string;
}

export interface InventoryMessage extends BaseMessage {
    type: ServerCommand.inventory;
    inventory: number[];
}

export interface MuzzleFlashMessage extends BaseMessage {
    type: ServerCommand.muzzleflash;
    ent: number;
    weapon: number;
}

export interface MuzzleFlash2Message extends BaseMessage {
    type: ServerCommand.muzzleflash2;
    ent: number;
    weapon: number;
}

export interface MuzzleFlash3Message extends BaseMessage {
    type: ServerCommand.muzzleflash3;
    ent: number;
    weapon: number;
}

export interface DisconnectMessage extends BaseMessage {
    type: ServerCommand.disconnect;
}

export interface ReconnectMessage extends BaseMessage {
    type: ServerCommand.reconnect;
}

export interface DownloadMessage extends BaseMessage {
    type: ServerCommand.download;
    size: number;
    percent: number;
    data?: Uint8Array;
}

export interface SplitClientMessage extends BaseMessage {
    type: ServerCommand.splitclient;
    clientNum: number;
}

export interface LevelRestartMessage extends BaseMessage {
    type: ServerCommand.level_restart;
}

export interface DamageMessage extends BaseMessage {
    type: ServerCommand.damage;
    indicators: DamageIndicator[];
}

export interface LocPrintMessage extends BaseMessage {
    type: ServerCommand.locprint;
    flags: number;
    base: string;
    args: string[];
}

export interface FogMessage extends BaseMessage {
    type: ServerCommand.fog;
    data: FogData;
}

export interface WaitingForPlayersMessage extends BaseMessage {
    type: ServerCommand.waitingforplayers;
    count: number;
}

export interface BotChatMessage extends BaseMessage {
    type: ServerCommand.bot_chat;
    message: string;
}

export interface PoiMessage extends BaseMessage {
    type: ServerCommand.poi;
    flags: number;
    pos: Vec3;
}

export interface HelpPathMessage extends BaseMessage {
    type: ServerCommand.help_path;
    pos: Vec3;
}

export interface AchievementMessage extends BaseMessage {
    type: ServerCommand.achievement;
    id: string;
}

export type Message =
    | ServerDataMessage
    | ConfigStringMessage
    | SpawnBaselineMessage
    | FrameMessage
    | CenterPrintMessage
    | StuffTextMessage
    | PrintMessage
    | SoundMessage
    | TempEntityMessage
    | LayoutMessage
    | InventoryMessage
    | MuzzleFlashMessage
    | MuzzleFlash2Message
    | MuzzleFlash3Message
    | DisconnectMessage
    | ReconnectMessage
    | DownloadMessage
    | SplitClientMessage
    | LevelRestartMessage
    | DamageMessage
    | LocPrintMessage
    | FogMessage
    | WaitingForPlayersMessage
    | BotChatMessage
    | PoiMessage
    | HelpPathMessage
    | AchievementMessage;

export class MessageCollector implements NetworkMessageHandler {
    public messages: Message[] = [];

    onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string, tickRate?: number, demoType?: number): void {
        this.messages.push({
            type: ServerCommand.serverdata,
            protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType
        });
    }
    onConfigString(index: number, str: string): void {
        this.messages.push({ type: ServerCommand.configstring, index, string: str });
    }
    onSpawnBaseline(entity: EntityState): void {
        this.messages.push({ type: ServerCommand.spawnbaseline, entity: { ...entity } }); // Clone entity state
    }
    onFrame(frame: FrameData): void {
        // Clone frame data to prevent mutation if reused
        const clonedFrame: FrameData = {
            ...frame,
            playerState: { ...frame.playerState, origin: { ...frame.playerState.origin }, velocity: { ...frame.playerState.velocity } }, // Shallow clone of player state structure, deep clone mutable parts if needed
            packetEntities: {
                delta: frame.packetEntities.delta,
                entities: frame.packetEntities.entities.map(e => ({ ...e, origin: {...e.origin}, angles: {...e.angles} }))
            }
        };
        this.messages.push({ type: ServerCommand.frame, data: clonedFrame });
    }
    onCenterPrint(msg: string): void {
        this.messages.push({ type: ServerCommand.centerprint, message: msg });
    }
    onStuffText(msg: string): void {
        this.messages.push({ type: ServerCommand.stufftext, text: msg });
    }
    onPrint(level: number, msg: string): void {
        this.messages.push({ type: ServerCommand.print, level, message: msg });
    }
    onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {
        this.messages.push({ type: ServerCommand.sound, flags, soundNum, volume, attenuation, offset, ent, pos: pos ? { ...pos } : undefined });
    }
    onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
        this.messages.push({
            type: ServerCommand.temp_entity,
            tempType: type,
            pos: { ...pos },
            pos2: pos2 ? { ...pos2 } : undefined,
            dir: dir ? { ...dir } : undefined,
            cnt, color, ent, srcEnt, destEnt
        });
    }
    onLayout(layout: string): void {
        this.messages.push({ type: ServerCommand.layout, layout });
    }
    onInventory(inventory: number[]): void {
        this.messages.push({ type: ServerCommand.inventory, inventory: [...inventory] });
    }
    onMuzzleFlash(ent: number, weapon: number): void {
        this.messages.push({ type: ServerCommand.muzzleflash, ent, weapon });
    }
    onMuzzleFlash2(ent: number, weapon: number): void {
        this.messages.push({ type: ServerCommand.muzzleflash2, ent, weapon });
    }
    onMuzzleFlash3(ent: number, weapon: number): void {
        this.messages.push({ type: ServerCommand.muzzleflash3, ent, weapon });
    }
    onDisconnect(): void {
        this.messages.push({ type: ServerCommand.disconnect });
    }
    onReconnect(): void {
        this.messages.push({ type: ServerCommand.reconnect });
    }
    onDownload(size: number, percent: number, data?: Uint8Array): void {
        this.messages.push({ type: ServerCommand.download, size, percent, data: data ? new Uint8Array(data) : undefined });
    }
    onSplitClient(clientNum: number): void {
        this.messages.push({ type: ServerCommand.splitclient, clientNum });
    }
    onLevelRestart(): void {
        this.messages.push({ type: ServerCommand.level_restart });
    }
    onDamage(indicators: DamageIndicator[]): void {
        this.messages.push({ type: ServerCommand.damage, indicators: indicators.map(i => ({...i, dir: {...i.dir}})) });
    }
    onLocPrint(flags: number, base: string, args: string[]): void {
        this.messages.push({ type: ServerCommand.locprint, flags, base, args: [...args] });
    }
    onFog(data: FogData): void {
        this.messages.push({ type: ServerCommand.fog, data: { ...data } });
    }
    onWaitingForPlayers(count: number): void {
        this.messages.push({ type: ServerCommand.waitingforplayers, count });
    }
    onBotChat(msg: string): void {
        this.messages.push({ type: ServerCommand.bot_chat, message: msg });
    }
    onPoi(flags: number, pos: Vec3): void {
        this.messages.push({ type: ServerCommand.poi, flags, pos: { ...pos } });
    }
    onHelpPath(pos: Vec3): void {
        this.messages.push({ type: ServerCommand.help_path, pos: { ...pos } });
    }
    onAchievement(id: string): void {
        this.messages.push({ type: ServerCommand.achievement, id });
    }
}

/**
 * Parses raw demo data and collects all messages.
 * Uses DemoReader to iterate through blocks and NetworkMessageParser to parse commands.
 */
export function collectMessages(demoData: Uint8Array): Message[] {
    const collector = new MessageCollector();
    // Use the demo buffer (handling slice offset)
    const buffer = (demoData.byteOffset === 0 && demoData.byteLength === demoData.buffer.byteLength
        ? demoData.buffer
        : demoData.slice().buffer) as ArrayBuffer;

    const reader = new DemoReader(buffer);

    // We need a reusable streaming buffer for the parser.
    // The parser consumes from a streaming buffer.
    // We can reuse the same parser instance or create new one for each block.
    // Reusing might be better if parser maintains state, but NetworkMessageParser is mostly stateless per block
    // (except for protocol version which needs to be known).
    // Wait, NetworkMessageParser DOES maintain `protocolVersion` state.
    // If the demo contains `svc_serverdata`, the parser updates its protocol version.
    // So we MUST reuse the parser instance.

    // Create a streaming buffer that we can reset/fill.
    const streamingBuffer = new StreamingBuffer(4096); // Start small, will grow
    const parser = new NetworkMessageParser(streamingBuffer, collector);

    while (reader.hasMore()) {
        const block = reader.readNextBlock();
        if (!block) break;

        // Reset buffer and append new block data
        streamingBuffer.reset();

        // block.data is a BinaryStream. We need its buffer.
        // BinaryStream doesn't expose raw buffer easily in all versions?
        // But `block.data` was created from `blockData` (slice) in `readNextBlock`.
        // We can access `block.data` methods.
        // However, `StreamingBuffer.append` takes `ArrayBuffer | Uint8Array`.
        // We can just read the bytes from the stream.

        // Wait, `readNextBlock` returns `data: BinaryStream`.
        // Let's modify DemoReader or just read from stream.
        const size = block.length;
        // The stream is positioned at 0.
        // If we can get the underlying buffer, that's best.
        // BinaryStream usually has `buffer` property if it's based on arraybuffer.
        // But `readNextBlock` creates `new BinaryStream(blockData)`.

        // For now, let's assume we can readBytes from the stream.
        // But `BinaryStream` in `shared` might not have `readBytes` returning Uint8Array?
        // Let's check `BinaryStream` interface.
        // Usually `readData(count)` returns Uint8Array.
        const data = block.data.readData(size);

        streamingBuffer.append(data);

        // Parse the block
        // NetworkMessageParser.parseMessage() loops until buffer is exhausted or bad command.
        parser.parseMessage();

        // If parser stops early (e.g. padding), that's fine for this block.
    }

    return collector.messages;
}
