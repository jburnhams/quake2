
// Rerelease Protocol Impl
import { BinaryStream, Vec3, ServerCommand, TempEntity, ANORMS } from '@quake2ts/shared';
import pako from 'pako';
import { StreamingBuffer } from '../stream/streamingBuffer.js';

export const PROTOCOL_VERSION_RERELEASE = 2023;

// Constants from Q2 source (qcommon/qcommon.h)
export const U_ORIGIN1   = (1 << 0);
export const U_ORIGIN2   = (1 << 1);
export const U_ANGLE2    = (1 << 2);
export const U_ANGLE3    = (1 << 3);
export const U_FRAME8    = (1 << 4);
export const U_EVENT     = (1 << 5);
export const U_REMOVE    = (1 << 6);
export const U_MOREBITS1 = (1 << 7);

export const U_NUMBER16  = (1 << 8);
export const U_ORIGIN3   = (1 << 9);
export const U_ANGLE1    = (1 << 10);
export const U_MODEL     = (1 << 11);
export const U_RENDERFX8 = (1 << 12);
export const U_ALPHA     = (1 << 13);
export const U_EFFECTS8  = (1 << 14);
export const U_MOREBITS2 = (1 << 15);

export const U_SKIN8     = (1 << 16);
export const U_FRAME16   = (1 << 17);
export const U_RENDERFX16 = (1 << 18);
export const U_EFFECTS16 = (1 << 19);
export const U_MODEL2    = (1 << 20);
export const U_MODEL3    = (1 << 21);
export const U_MODEL4    = (1 << 22);
export const U_MOREBITS3 = (1 << 23);

export const U_OLDORIGIN = (1 << 24);
export const U_SKIN16    = (1 << 25);
export const U_SOUND     = (1 << 26);
export const U_SOLID     = (1 << 27);

export const U_SCALE         = (1 << 28);
export const U_INSTANCE_BITS = (1 << 29);
export const U_LOOP_VOLUME   = (1 << 30);
export const U_MOREBITS4     = 0x80000000 | 0;

export const U_LOOP_ATTENUATION_HIGH = (1 << 0);
export const U_OWNER_HIGH            = (1 << 1);
export const U_OLD_FRAME_HIGH        = (1 << 2);

const RECORD_NETWORK = 0x00;
const RECORD_CLIENT  = 0x01;
const RECORD_SERVER  = 0x02;
const RECORD_RELAY   = 0x80;

export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

export interface EntityState {
  number: number;
  modelindex: number;
  modelindex2: number;
  modelindex3: number;
  modelindex4: number;
  frame: number;
  skinnum: number;
  effects: number;
  renderfx: number;
  origin: MutableVec3;
  old_origin: MutableVec3;
  angles: MutableVec3;
  sound: number;
  event: number;
  solid: number;
  bits: number;
  bitsHigh: number;
  alpha: number;
  scale: number;
  instanceBits: number;
  loopVolume: number;
  loopAttenuation: number;
  owner: number;
  oldFrame: number;
}

export const createEmptyEntityState = (): EntityState => ({
  number: 0,
  modelindex: 0,
  modelindex2: 0,
  modelindex3: 0,
  modelindex4: 0,
  frame: 0,
  skinnum: 0,
  effects: 0,
  renderfx: 0,
  origin: { x: 0, y: 0, z: 0 },
  old_origin: { x: 0, y: 0, z: 0 },
  angles: { x: 0, y: 0, z: 0 },
  sound: 0,
  event: 0,
  solid: 0,
  bits: 0,
  bitsHigh: 0,
  alpha: 0,
  scale: 0,
  instanceBits: 0,
  loopVolume: 0,
  loopAttenuation: 0,
  owner: 0,
  oldFrame: 0
});

export interface ProtocolPlayerState {
  pm_type: number;
  origin: MutableVec3;
  velocity: MutableVec3;
  pm_time: number;
  pm_flags: number;
  gravity: number;
  delta_angles: MutableVec3;
  viewoffset: MutableVec3;
  viewangles: MutableVec3;
  kick_angles: MutableVec3;
  gun_index: number;
  gun_frame: number;
  gun_offset: MutableVec3;
  gun_angles: MutableVec3;
  blend: number[];
  fov: number;
  rdflags: number;
  stats: number[];
  gunskin: number;
  gunrate: number;
  damage_blend: number[];
  team_id: number;
}

export const createEmptyProtocolPlayerState = (): ProtocolPlayerState => ({
  pm_type: 0,
  origin: { x: 0, y: 0, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  pm_time: 0,
  pm_flags: 0,
  gravity: 0,
  delta_angles: { x: 0, y: 0, z: 0 },
  viewoffset: { x: 0, y: 0, z: 0 },
  viewangles: { x: 0, y: 0, z: 0 },
  kick_angles: { x: 0, y: 0, z: 0 },
  gun_index: 0,
  gun_frame: 0,
  gun_offset: { x: 0, y: 0, z: 0 },
  gun_angles: { x: 0, y: 0, z: 0 },
  blend: [0, 0, 0, 0],
  fov: 0,
  rdflags: 0,
  stats: new Array(32).fill(0),
  gunskin: 0,
  gunrate: 0,
  damage_blend: [0, 0, 0, 0],
  team_id: 0
});

export interface FrameData {
    serverFrame: number;
    deltaFrame: number;
    surpressCount: number;
    areaBytes: number;
    areaBits: Uint8Array;
    playerState: ProtocolPlayerState;
    packetEntities: {
        delta: boolean;
        entities: EntityState[];
    };
}

export interface FogData {
    density?: number;
    skyfactor?: number;
    red?: number;
    green?: number;
    blue?: number;
    time?: number;
    hf_falloff?: number;
    hf_density?: number;
    hf_start_r?: number;
    hf_start_g?: number;
    hf_start_b?: number;
    hf_start_dist?: number;
    hf_end_r?: number;
    hf_end_g?: number;
    hf_end_b?: number;
    hf_end_dist?: number;
}

export interface DamageIndicator {
    damage: number;
    health: boolean;
    armor: boolean;
    power: boolean;
    dir: Vec3;
}

export interface NetworkMessageHandler {
    onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string, tickRate?: number, demoType?: number): void;
    onConfigString(index: number, str: string): void;
    onSpawnBaseline(entity: EntityState): void;
    onFrame(frame: FrameData): void;
    onCenterPrint(msg: string): void;
    onStuffText(msg: string): void;
    onPrint(level: number, msg: string): void;
    onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void;
    onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void;
    onLayout(layout: string): void;
    onInventory(inventory: number[]): void;
    onMuzzleFlash(ent: number, weapon: number): void;
    onMuzzleFlash2(ent: number, weapon: number): void;
    onDisconnect(): void;
    onReconnect(): void;
    onDownload(size: number, percent: number, data?: Uint8Array): void;
    getEntities?(): Map<number, EntityState>;
    getPlayerState?(): ProtocolPlayerState | null;
    onSplitClient?(clientNum: number): void;
    onConfigBlast?(index: number, data: Uint8Array): void;
    onSpawnBaselineBlast?(entity: EntityState): void;
    onLevelRestart?(): void;
    onDamage?(indicators: DamageIndicator[]): void;
    onLocPrint?(flags: number, base: string, args: string[]): void;
    onFog?(data: FogData): void;
    onWaitingForPlayers?(count: number): void;
    onBotChat?(msg: string): void;
    onPoi?(flags: number, pos: Vec3): void;
    onHelpPath?(pos: Vec3): void;
    onMuzzleFlash3?(ent: number, weapon: number): void;
    onAchievement?(id: string): void;
}

export interface ParseResult {
    commandsParsed: number;
    parseState: 'awaiting_data' | 'complete' | 'error';
    bytesConsumed: number;
}

/**
 * Adapter to allow using BinaryStream where StreamingBuffer is expected
 * Used for backward compatibility or when reading from compressed/decompressed buffers.
 */
class BinaryStreamAdapter extends StreamingBuffer {
    constructor(private stream: BinaryStream) {
        super(0);
    }

    override readByte(): number { return this.stream.readByte(); }
    override readShort(): number { return this.stream.readShort(); }
    override readLong(): number { return this.stream.readLong(); }
    override readFloat(): number { return this.stream.readFloat(); }
    override readString(): string { return this.stream.readString(); }
    override readData(count: number): Uint8Array { return this.stream.readData(count); }
    override hasBytes(count: number): boolean { return this.stream.hasMore(); }
    override available(): number { return this.stream.getRemaining(); } // Assuming getRemaining exists on BinaryStream interface in shared
    override getReadPosition(): number { return this.stream.getPosition(); }
    override peekBytes(count: number): Uint8Array {
         throw new Error("peekBytes not implemented for BinaryStreamAdapter");
    }
}

// Protocol 34 (Original Q2) Opcode Mapping
const PROTO34_MAP: Record<number, number> = {
    0: ServerCommand.bad,
    1: ServerCommand.nop,
    2: ServerCommand.disconnect,
    3: ServerCommand.reconnect,
    4: ServerCommand.download,
    5: ServerCommand.frame,
    6: ServerCommand.inventory,
    7: ServerCommand.layout,
    8: ServerCommand.muzzleflash,
    9: ServerCommand.muzzleflash2,
    10: ServerCommand.temp_entity,
    11: ServerCommand.sound,
    12: ServerCommand.print,
    13: ServerCommand.stufftext,
    14: ServerCommand.serverdata,
    15: ServerCommand.configstring,
    16: ServerCommand.spawnbaseline,
    17: ServerCommand.centerprint,
    18: ServerCommand.playerinfo,
    19: ServerCommand.packetentities,
    20: ServerCommand.deltapacketentities
};

export class NetworkMessageParser {
  private stream: StreamingBuffer;
  private protocolVersion: number = 0;
  private isDemo: number = RECORD_CLIENT;
  private handler?: NetworkMessageHandler;
  private strictMode: boolean = false;
  private errorCount: number = 0;

  constructor(stream: StreamingBuffer | BinaryStream, handler?: NetworkMessageHandler, strictMode: boolean = false) {
    if (stream instanceof BinaryStream) {
        this.stream = new BinaryStreamAdapter(stream);
    } else {
        this.stream = stream;
    }
    this.handler = handler;
    this.strictMode = strictMode;
  }

  public setProtocolVersion(version: number): void {
      this.protocolVersion = version;
  }

  public getProtocolVersion(): number {
      return this.protocolVersion;
  }

  public getErrorCount(): number {
      return this.errorCount;
  }

  private translateCommand(cmd: number): number {
    if (this.protocolVersion === 0) {
        if (cmd === 7) return ServerCommand.serverdata;
        if (cmd === 12) return ServerCommand.serverdata;
        return cmd;
    }

    if (this.protocolVersion === PROTOCOL_VERSION_RERELEASE) {
      return cmd;
    }

    if (this.protocolVersion === 25 || this.protocolVersion === 26) {
        if (cmd === 0) return ServerCommand.bad;
        const translated = cmd + 5;
        if (translated >= ServerCommand.nop && translated <= ServerCommand.frame) {
            return translated;
        }
        return ServerCommand.bad;
    }

    if (this.protocolVersion === 34) {
        // Use the mapping table
        if (PROTO34_MAP[cmd] !== undefined) {
            return PROTO34_MAP[cmd];
        }
        return ServerCommand.bad;
    }

    return cmd;
  }

  public parseMessage(): void {
    while (this.stream.hasBytes(1)) {
      const startPos = this.stream.getReadPosition();
      let cmd = -1;

      try {
        cmd = this.stream.readByte();

        if (cmd === -1) break;

        const originalCmd = cmd;
        cmd = this.translateCommand(cmd);

        switch (cmd) {
          case ServerCommand.bad:
            // Terminate this parse cycle, usually padding or end of demo block
            return;
          case ServerCommand.nop: break;
          case ServerCommand.disconnect: if (this.handler?.onDisconnect) this.handler.onDisconnect(); break;
          case ServerCommand.reconnect: if (this.handler?.onReconnect) this.handler.onReconnect(); break;
          case ServerCommand.print: this.parsePrint(); break;
          case ServerCommand.serverdata: this.parseServerData(); break;
          case ServerCommand.configstring: this.parseConfigString(); break;
          case ServerCommand.spawnbaseline: this.parseSpawnBaseline(); break;
          case ServerCommand.centerprint: this.parseCenterPrint(); break;
          case ServerCommand.download: this.parseDownload(); break;
          case ServerCommand.frame: this.parseFrame(); break;
          case ServerCommand.packetentities: this.parsePacketEntities(false); break;
          case ServerCommand.deltapacketentities: this.parsePacketEntities(true); break;
          case ServerCommand.playerinfo: this.parsePlayerState(); break;
          case ServerCommand.stufftext: this.parseStuffText(); break;
          case ServerCommand.layout: this.parseLayout(); break;
          case ServerCommand.inventory: this.parseInventory(); break;
          case ServerCommand.sound: this.parseSound(); break;
          case ServerCommand.muzzleflash: this.parseMuzzleFlash(); break;
          case ServerCommand.muzzleflash2: this.parseMuzzleFlash2(); break;
          case ServerCommand.temp_entity: this.parseTempEntity(); break;
          case ServerCommand.splitclient: this.parseSplitClient(); break;
          case ServerCommand.configblast: this.parseConfigBlast(); break;
          case ServerCommand.spawnbaselineblast: this.parseSpawnBaselineBlast(); break;
          case ServerCommand.level_restart: if (this.handler?.onLevelRestart) this.handler.onLevelRestart(); break;
          case ServerCommand.damage: this.parseDamage(); break;
          case ServerCommand.locprint: this.parseLocPrint(); break;
          case ServerCommand.fog: this.parseFog(); break;
          case ServerCommand.waitingforplayers: this.parseWaitingForPlayers(); break;
          case ServerCommand.bot_chat: this.parseBotChat(); break;
          case ServerCommand.poi: this.parsePoi(); break;
          case ServerCommand.help_path: this.parseHelpPath(); break;
          case ServerCommand.muzzleflash3: this.parseMuzzleFlash3(); break;
          case ServerCommand.achievement: this.parseAchievement(); break;

          default:
            const errorMsg = `Unknown server command: ${originalCmd} (translated: ${cmd}) at offset ${startPos}`;
            if (this.strictMode) throw new Error(errorMsg);
            console.warn(errorMsg);
            this.errorCount++;
            return;
        }

      } catch (e) {
          const errMsg = (e as Error).message;
          if (errMsg === 'Buffer underflow' || errMsg.includes('StreamingBuffer')) {
              try {
                  this.stream.setReadPosition(startPos);
              } catch (rollbackErr) {
                  console.error('Failed to rollback stream position', rollbackErr);
              }
              return;
          }

          const context = `offset ${startPos}, cmd ${cmd}, protocol ${this.protocolVersion}`;
          console.warn(`Error parsing command ${cmd} (${context}): ${errMsg}`);
          this.errorCount++;

          if (this.strictMode) throw e;
          return;
      }
    }
  }

  private readAngle16(): number { return this.stream.readShort() * (360.0 / 65536); }
  private readCoord(): number { return this.stream.readShort() * 0.125; }
  private readAngle(): number { return this.stream.readByte() * (360.0 / 256); }

  private readPos(out: MutableVec3): void {
      out.x = this.stream.readShort() * 0.125;
      out.y = this.stream.readShort() * 0.125;
      out.z = this.stream.readShort() * 0.125;
  }

  private readDir(out: MutableVec3): void {
      const b = this.stream.readByte();
      if (b >= ANORMS.length) {
          out.x=0; out.y=0; out.z=0;
      } else {
          const n = ANORMS[b];
          out.x = n[0]; out.y = n[1]; out.z = n[2];
      }
  }

  private parsePrint(): void {
      const id = this.stream.readByte();
      const str = this.stream.readString();
      if (this.handler) this.handler.onPrint(id, str);
  }

  private parseStuffText(): void {
      const text = this.stream.readString();
      if (this.handler) this.handler.onStuffText(text);
  }

  private parseLayout(): void {
      const layout = this.stream.readString();
      if (this.handler) this.handler.onLayout(layout);
  }

  private parseCenterPrint(): void {
      const centerMsg = this.stream.readString();
      if (this.handler) this.handler.onCenterPrint(centerMsg);
  }

  private parseServerData(): void {
    this.protocolVersion = this.stream.readLong();
    if (this.protocolVersion === PROTOCOL_VERSION_RERELEASE) {
        const spawnCount = this.stream.readLong();
        const demoType = this.stream.readByte();
        this.isDemo = demoType;
        const tickRate = this.stream.readByte();
        const gameDir = this.stream.readString();
        let playerNum = this.stream.readShort();
        if (playerNum === -2) {
             const numSplits = this.stream.readShort();
             for (let i = 0; i < numSplits; i++) this.stream.readShort();
             playerNum = 0;
        } else if (playerNum === -1) {
            playerNum = -1;
        }
        const levelName = this.stream.readString();
        if (this.handler) this.handler.onServerData(this.protocolVersion, spawnCount, 0, gameDir, playerNum, levelName, tickRate, demoType);
    } else {
        const serverCount = this.stream.readLong();
        const attractLoop = this.stream.readByte();
        this.isDemo = attractLoop;
        const gameDir = this.stream.readString();
        const playerNum = this.stream.readShort();
        const levelName = this.stream.readString();
        if (this.handler) this.handler.onServerData(this.protocolVersion, serverCount, attractLoop, gameDir, playerNum, levelName);
    }
  }

  private parseConfigString(): void {
    const index = this.stream.readShort();
    const str = this.stream.readString();
    if (this.handler) this.handler.onConfigString(index, str);
  }

  private parseSplitClient(): void {
      const clientNum = this.stream.readByte();
      if (this.handler?.onSplitClient) this.handler.onSplitClient(clientNum);
  }

  private parseConfigBlast(): void {
    const compressedSize = this.stream.readShort();
    const uncompressedSize = this.stream.readShort();
    const compressedData = this.stream.readData(compressedSize);
    try {
        const decompressed = pako.inflate(compressedData);
        const blastStream = new BinaryStream(decompressed.buffer);
        while (blastStream.hasMore()) {
            const index = blastStream.readUShort();
            const str = blastStream.readString();
            if (this.handler) this.handler.onConfigString(index, str);
        }
    } catch (e) {
        console.error('svc_configblast error', e);
    }
  }

  private parseSpawnBaselineBlast(): void {
      const compressedSize = this.stream.readShort();
      const uncompressedSize = this.stream.readShort();
      const compressedData = this.stream.readData(compressedSize);
      try {
          const decompressed = pako.inflate(compressedData);
          const blastStream = new BinaryStream(decompressed.buffer);
          const blastParser = new NetworkMessageParser(blastStream, this.handler, this.strictMode);
          blastParser.setProtocolVersion(this.protocolVersion);
          while (blastStream.hasMore()) {
              blastParser.parseSpawnBaseline();
          }
      } catch (e) {
          console.error('svc_spawnbaselineblast error', e);
      }
  }

  private parseLocPrint(): void {
      const flags = this.stream.readByte();
      const base = this.stream.readString();
      const numArgs = this.stream.readByte();
      const args: string[] = [];
      for(let i=0; i<numArgs; i++) args.push(this.stream.readString());
      if (this.handler?.onLocPrint) this.handler.onLocPrint(flags, base, args);
  }

  private parseWaitingForPlayers(): void {
      const count = this.stream.readByte();
      if (this.handler?.onWaitingForPlayers) this.handler.onWaitingForPlayers(count);
  }

  private parseBotChat(): void {
      const botName = this.stream.readString();
      const clientIndex = this.stream.readShort();
      const locString = this.stream.readString();
      if (this.handler?.onBotChat) this.handler.onBotChat(locString);
  }

  private parsePoi(): void {
      const key = this.stream.readShort();
      const time = this.stream.readShort();
      const pos = {x:0, y:0, z:0};
      this.readPos(pos);
      const imageIndex = this.stream.readShort();
      const paletteIndex = this.stream.readByte();
      const flags = this.stream.readByte();
      if (this.handler?.onPoi) this.handler.onPoi(flags, pos);
  }

  private parseHelpPath(): void {
      const start = this.stream.readByte();
      const pos = {x:0, y:0, z:0};
      this.readPos(pos);
      const dir = {x:0, y:0, z:0};
      this.readDir(dir);
      if (this.handler?.onHelpPath) this.handler.onHelpPath(pos);
  }

  private parseAchievement(): void {
      const idStr = this.stream.readString();
      if (this.handler?.onAchievement) this.handler.onAchievement(idStr);
  }

  private parseDownload(): void {
    const size = this.stream.readShort();
    const percent = this.stream.readByte();
    let data: Uint8Array | undefined;
    if (size > 0) data = this.stream.readData(size);
    if (this.handler) this.handler.onDownload(size, percent, data);
  }

  private parseInventory(): void {
    const MAX_ITEMS = 256;
    const inventory = new Array(MAX_ITEMS);
    for (let i = 0; i < MAX_ITEMS; i++) inventory[i] = this.stream.readShort();
    if (this.handler) this.handler.onInventory(inventory);
  }

  private parseSound(): void {
     const mask = this.stream.readByte();
     const soundNum = this.stream.readByte();
     let volume: number | undefined;
     let attenuation: number | undefined;
     let offset: number | undefined;
     let ent: number | undefined;
     let pos: Vec3 | undefined;

     if (mask & 1) volume = this.stream.readByte();
     if (mask & 2) attenuation = this.stream.readByte();
     if (mask & 16) offset = this.stream.readByte();
     if (mask & 8) ent = this.stream.readShort();
     if (mask & 4) {
         const p = { x: 0, y: 0, z: 0 };
         this.readPos(p);
         pos = p;
     }
     if (this.handler) this.handler.onSound(mask, soundNum, volume, attenuation, offset, ent, pos);
  }

  private parseMuzzleFlash(): void {
     const ent = this.stream.readShort();
     const weapon = this.stream.readByte();
     if (this.handler) this.handler.onMuzzleFlash(ent, weapon);
  }

  private parseMuzzleFlash2(): void {
     const ent = this.stream.readShort();
     const weapon = this.stream.readByte();
     if (this.handler) this.handler.onMuzzleFlash2(ent, weapon);
  }

  private parseMuzzleFlash3(): void {
     const ent = this.stream.readShort();
     const weapon = this.stream.readShort();
     if (this.handler?.onMuzzleFlash3) this.handler.onMuzzleFlash3(ent, weapon);
  }

  private parseFog(): void {
      let bits = this.stream.readByte();
      if (bits & 0x80) {
          const high = this.stream.readByte();
          bits |= (high << 8);
      }
      const fog: FogData = {};
      if (bits & 1) { fog.density = this.stream.readFloat(); fog.skyfactor = this.stream.readByte(); }
      if (bits & 2) fog.red = this.stream.readByte();
      if (bits & 4) fog.green = this.stream.readByte();
      if (bits & 8) fog.blue = this.stream.readByte();
      if (bits & 16) fog.time = this.stream.readShort();
      if (bits & 32) fog.hf_falloff = this.stream.readFloat();
      if (bits & 64) fog.hf_density = this.stream.readFloat();
      if (bits & 256) fog.hf_start_r = this.stream.readByte();
      if (bits & 512) fog.hf_start_g = this.stream.readByte();
      if (bits & 1024) fog.hf_start_b = this.stream.readByte();
      if (bits & 2048) fog.hf_start_dist = this.stream.readLong();
      if (bits & 4096) fog.hf_end_r = this.stream.readByte();
      if (bits & 8192) fog.hf_end_g = this.stream.readByte();
      if (bits & 16384) fog.hf_end_b = this.stream.readByte();
      if (bits & 32768) fog.hf_end_dist = this.stream.readLong();
      if (this.handler?.onFog) this.handler.onFog(fog);
  }

  private parseDamage(): void {
      const num = this.stream.readByte();
      const indicators: DamageIndicator[] = [];
      for (let i = 0; i < num; i++) {
          const encoded = this.stream.readByte();
          const dir = { x: 0, y: 0, z: 0 };
          this.readDir(dir);
          const damage = encoded & 0x1F;
          const health = (encoded & 0x20) !== 0;
          const armor = (encoded & 0x40) !== 0;
          const power = (encoded & 0x80) !== 0;
          indicators.push({ damage, health, armor, power, dir });
      }
      if (this.handler?.onDamage) this.handler.onDamage(indicators);
  }

  private parseTempEntity(): void {
      const type = this.stream.readByte();
      const pos = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 0, y: 0, z: 0 };
      const dir = { x: 0, y: 0, z: 0 };
      let cnt: number | undefined;
      let color: number | undefined;
      let ent: number | undefined;
      let srcEnt: number | undefined;
      let destEnt: number | undefined;

      // Simplification of switch for brevity - maintaining same logic
      switch (type) {
        case TempEntity.EXPLOSION1: case TempEntity.EXPLOSION2: case TempEntity.ROCKET_EXPLOSION: case TempEntity.GRENADE_EXPLOSION:
        case TempEntity.ROCKET_EXPLOSION_WATER: case TempEntity.GRENADE_EXPLOSION_WATER: case TempEntity.BFG_EXPLOSION: case TempEntity.BFG_BIGEXPLOSION:
        case TempEntity.BOSSTPORT: case TempEntity.PLASMA_EXPLOSION: case TempEntity.PLAIN_EXPLOSION: case TempEntity.CHAINFIST_SMOKE:
        case TempEntity.TRACKER_EXPLOSION: case TempEntity.TELEPORT_EFFECT: case TempEntity.DBALL_GOAL: case TempEntity.NUKEBLAST:
        case TempEntity.WIDOWSPLASH: case TempEntity.EXPLOSION1_BIG: case TempEntity.EXPLOSION1_NP:
            this.readPos(pos); break;
        case TempEntity.GUNSHOT: case TempEntity.BLOOD: case TempEntity.BLASTER: case TempEntity.SHOTGUN: case TempEntity.SPARKS:
        case TempEntity.BULLET_SPARKS: case TempEntity.SCREEN_SPARKS: case TempEntity.SHIELD_SPARKS: case TempEntity.BLASTER2: case TempEntity.FLECHETTE:
        case TempEntity.MOREBLOOD: case TempEntity.ELECTRIC_SPARKS: case TempEntity.HEATBEAM_SPARKS: case TempEntity.HEATBEAM_STEAM:
            this.readPos(pos); this.readDir(dir); break;
        case TempEntity.SPLASH: case TempEntity.LASER_SPARKS: case TempEntity.WELDING_SPARKS: case TempEntity.TUNNEL_SPARKS:
            cnt = this.stream.readByte(); this.readPos(pos); this.readDir(dir); color = this.stream.readByte(); break;
        case TempEntity.BLUEHYPERBLASTER:
            if (this.protocolVersion >= 32) { this.readPos(pos); this.readPos(pos2); } else { this.readPos(pos); this.readDir(dir); } break;
        case TempEntity.GREENBLOOD:
            if (this.protocolVersion >= 32) { this.readPos(pos); this.readDir(dir); } else { this.readPos(pos); this.readPos(pos2); } break;
        case TempEntity.RAILTRAIL: case TempEntity.BUBBLETRAIL: case TempEntity.BFG_LASER: case TempEntity.DEBUGTRAIL: case TempEntity.BUBBLETRAIL2:
            this.readPos(pos); this.readPos(pos2); break;
        case TempEntity.PARASITE_ATTACK: case TempEntity.MEDIC_CABLE_ATTACK:
            this.stream.readShort(); this.readPos(pos); this.readPos(pos2); break;
        case TempEntity.GRAPPLE_CABLE:
            ent = this.stream.readShort(); this.readPos(pos); this.readPos(pos2); this.readPos(dir); break;
        case TempEntity.LIGHTNING:
            srcEnt = this.stream.readShort(); destEnt = this.stream.readShort(); this.readPos(pos); this.readPos(pos2); break;
        case TempEntity.FLASHLIGHT:
            this.readPos(pos); ent = this.stream.readShort(); break;
        case TempEntity.FORCEWALL:
            this.readPos(pos); this.readPos(pos2); color = this.stream.readByte(); break;
        case TempEntity.STEAM:
             const nextId = this.stream.readShort(); cnt = this.stream.readByte(); this.readPos(pos); this.readDir(dir);
             color = this.stream.readByte(); this.stream.readShort();
             if (nextId !== -1) this.stream.readLong();
             break;
        case TempEntity.WIDOWBEAMOUT: this.stream.readShort();
        case TempEntity.HEATBEAM: case TempEntity.MONSTER_HEATBEAM:
            ent = this.stream.readShort(); this.readPos(pos); this.readPos(pos2); this.readDir(dir); break;
      }
      if (this.handler) this.handler.onTempEntity(type, pos, pos2, dir, cnt, color, ent, srcEnt, destEnt);
  }

  private parseSpawnBaseline(): void {
    const bits = this.parseEntityBits();
    const entity = createEmptyEntityState();
    this.parseDelta(createEmptyEntityState(), entity, bits.number, bits.bits, bits.bitsHigh);
    if (this.handler) this.handler.onSpawnBaseline(entity);
  }

  private parseFrame(): void {
      const serverFrame = this.stream.readLong();
      const deltaFrame = this.stream.readLong();
      let surpressCount = 0;

      // Protocol 26 (legacy) hack:
      // In original Quake 2, protocol 26 demos did NOT include the suppressCount byte.
      // See full/client/cl_ents.c:679-681
      // Protocol 25 also seems to lack this byte based on testing with demo1.dm2
      if (this.protocolVersion !== 26 && this.protocolVersion !== 25) {
          surpressCount = this.stream.readByte();
      }

      const areaBytes = this.stream.readByte();
      const areaBits = this.stream.readData(areaBytes);

      let piCmd = this.stream.readByte();
      piCmd = this.translateCommand(piCmd);
      if (piCmd !== ServerCommand.playerinfo) {
          if (this.strictMode) throw new Error(`Expected svc_playerinfo after svc_frame, got ${piCmd}`);
          return;
      }
      const playerState = this.parsePlayerState();

      let peCmd = this.stream.readByte();
      peCmd = this.translateCommand(peCmd);
      if (peCmd !== ServerCommand.packetentities && peCmd !== ServerCommand.deltapacketentities) {
          if (this.strictMode) throw new Error(`Expected svc_packetentities after svc_playerinfo, got ${peCmd}`);
          return;
      }
      const entities = this.collectPacketEntities();

      if (this.isDemo === RECORD_RELAY) {
          const connectedCount = this.stream.readByte();
          for(let i=0; i<connectedCount; i++) this.stream.readByte();
      }
      if (this.isDemo === RECORD_SERVER) this.stream.readLong();

      if (this.handler) this.handler.onFrame({
              serverFrame, deltaFrame, surpressCount, areaBytes, areaBits, playerState,
              packetEntities: { delta: true, entities }
      });
  }

  private parsePlayerState(): ProtocolPlayerState {
      const ps = createEmptyProtocolPlayerState();
      const flags = this.stream.readShort();
      if (flags & 1) ps.pm_type = this.stream.readByte();
      if (flags & 2) { ps.origin.x = this.readCoord(); ps.origin.y = this.readCoord(); ps.origin.z = this.readCoord(); }
      if (flags & 4) { ps.velocity.x = this.readCoord(); ps.velocity.y = this.readCoord(); ps.velocity.z = this.readCoord(); }
      if (flags & 8) ps.pm_time = this.stream.readByte();
      if (flags & 16) ps.pm_flags = this.stream.readByte();
      if (flags & 32) ps.gravity = this.stream.readShort();
      if (flags & 64) { ps.delta_angles.x = this.stream.readShort() * (180 / 32768); ps.delta_angles.y = this.stream.readShort() * (180 / 32768); ps.delta_angles.z = this.stream.readShort() * (180 / 32768); }
      if (flags & 128) {
          ps.viewoffset.x = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.viewoffset.y = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.viewoffset.z = (this.stream.readByte() << 24 >> 24) * 0.25;
      }
      if (flags & 256) { ps.viewangles.x = this.readAngle16(); ps.viewangles.y = this.readAngle16(); ps.viewangles.z = this.readAngle16(); }
      if (flags & 512) {
          ps.kick_angles.x = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.kick_angles.y = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.kick_angles.z = (this.stream.readByte() << 24 >> 24) * 0.25;
      }
      if (flags & 4096) ps.gun_index = this.stream.readByte();
      if (flags & 8192) {
          ps.gun_frame = this.stream.readByte();
          ps.gun_offset.x = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.gun_offset.y = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.gun_offset.z = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.gun_angles.x = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.gun_angles.y = (this.stream.readByte() << 24 >> 24) * 0.25;
          ps.gun_angles.z = (this.stream.readByte() << 24 >> 24) * 0.25;
      }
      if (flags & 1024) { ps.blend[0] = this.stream.readByte(); ps.blend[1] = this.stream.readByte(); ps.blend[2] = this.stream.readByte(); ps.blend[3] = this.stream.readByte(); }
      if (flags & 2048) ps.fov = this.stream.readByte();
      if (flags & 16384) ps.rdflags = this.stream.readByte();
      const statbits = this.stream.readLong();
      for (let i = 0; i < 32; i++) if (statbits & (1 << i)) ps.stats[i] = this.stream.readShort();
      return ps;
  }

  private parsePacketEntities(delta: boolean): void {
      const entities = this.collectPacketEntities();
      if (this.handler) this.handler.onFrame({
              serverFrame: 0, deltaFrame: 0, surpressCount: 0, areaBytes: 0, areaBits: new Uint8Array(),
              playerState: createEmptyProtocolPlayerState(),
              packetEntities: { delta, entities }
      });
  }

  private collectPacketEntities(): EntityState[] {
      const entities: EntityState[] = [];
      while (true) {
          const bits = this.parseEntityBits();
          if (bits.bits & U_REMOVE) {
              if (bits.number === 0) break;
              continue;
          }
          const entity = createEmptyEntityState();
          const forceParse = bits.number === 0 && !(bits.bits & U_MOREBITS1);
          if (bits.number !== 0 || forceParse) {
              this.parseDelta(createEmptyEntityState(), entity, bits.number, bits.bits, bits.bitsHigh);
          }
          if (bits.number === 0) break;
          entities.push(entity);
      }
      return entities;
  }

  private parseEntityBits(): { number: number; bits: number; bitsHigh: number } {
      let total = this.stream.readByte();
      if (total & U_MOREBITS1) total |= (this.stream.readByte() << 8);
      if (total & U_MOREBITS2) total |= (this.stream.readByte() << 16);
      if (total & U_MOREBITS3) total |= (this.stream.readByte() << 24);
      let bitsHigh = 0;
      if (this.protocolVersion === PROTOCOL_VERSION_RERELEASE) {
          if (total & U_MOREBITS4) bitsHigh = this.stream.readByte();
      }
      let number: number;
      if (total & U_NUMBER16) number = this.stream.readShort();
      else number = this.stream.readByte();
      return { number, bits: total, bitsHigh };
  }

  private parseDelta(from: EntityState, to: EntityState, number: number, bits: number, bitsHigh: number = 0): void {
      to.number = from.number; to.modelindex = from.modelindex; to.modelindex2 = from.modelindex2; to.modelindex3 = from.modelindex3; to.modelindex4 = from.modelindex4;
      to.frame = from.frame; to.skinnum = from.skinnum; to.effects = from.effects; to.renderfx = from.renderfx;
      to.origin.x = from.origin.x; to.origin.y = from.origin.y; to.origin.z = from.origin.z;
      to.old_origin.x = from.origin.x; to.old_origin.y = from.origin.y; to.old_origin.z = from.origin.z;
      to.angles.x = from.angles.x; to.angles.y = from.angles.y; to.angles.z = from.angles.z;
      to.sound = from.sound; to.event = from.event; to.solid = from.solid;
      to.alpha = from.alpha; to.scale = from.scale; to.instanceBits = from.instanceBits;
      to.loopVolume = from.loopVolume; to.loopAttenuation = from.loopAttenuation; to.owner = from.owner; to.oldFrame = from.oldFrame;
      to.number = number; to.bits = bits; to.bitsHigh = bitsHigh;

      if (bits & U_MODEL) to.modelindex = this.stream.readByte();
      if (bits & U_MODEL2) to.modelindex2 = this.stream.readByte();
      if (bits & U_MODEL3) to.modelindex3 = this.stream.readByte();
      if (bits & U_MODEL4) to.modelindex4 = this.stream.readByte();
      if (bits & U_FRAME8) to.frame = this.stream.readByte();
      if (bits & U_FRAME16) to.frame = this.stream.readShort();
      if ((bits & U_SKIN8) && (bits & U_SKIN16)) to.skinnum = this.stream.readLong();
      else if (bits & U_SKIN8) to.skinnum = this.stream.readByte();
      else if (bits & U_SKIN16) to.skinnum = this.stream.readShort();
      if ((bits & U_EFFECTS8) && (bits & U_EFFECTS16)) to.effects = this.stream.readLong();
      else if (bits & U_EFFECTS8) to.effects = this.stream.readByte();
      else if (bits & U_EFFECTS16) to.effects = this.stream.readShort();
      if ((bits & U_RENDERFX8) && (bits & U_RENDERFX16)) to.renderfx = this.stream.readLong();
      else if (bits & U_RENDERFX8) to.renderfx = this.stream.readByte();
      else if (bits & U_RENDERFX16) to.renderfx = this.stream.readShort();
      if (bits & U_ORIGIN1) to.origin.x = this.readCoord();
      if (bits & U_ORIGIN2) to.origin.y = this.readCoord();
      if (bits & U_ORIGIN3) to.origin.z = this.readCoord();
      if (bits & U_ANGLE1) to.angles.x = this.readAngle();
      if (bits & U_ANGLE2) to.angles.y = this.readAngle();
      if (bits & U_ANGLE3) to.angles.z = this.readAngle();
      if (bits & U_OLDORIGIN) this.readPos(to.old_origin);
      if (bits & U_SOUND) to.sound = this.stream.readByte();
      if (bits & U_EVENT) to.event = this.stream.readByte(); else to.event = 0;
      if (bits & U_SOLID) to.solid = this.stream.readShort();

      if (this.protocolVersion === PROTOCOL_VERSION_RERELEASE) {
          if (bits & U_ALPHA) to.alpha = this.stream.readByte() / 255.0;
          if (bits & U_SCALE) to.scale = this.stream.readFloat();
          if (bits & U_INSTANCE_BITS) to.instanceBits = this.stream.readLong();
          if (bits & U_LOOP_VOLUME) to.loopVolume = this.stream.readByte() / 255.0;
          if (bitsHigh & U_LOOP_ATTENUATION_HIGH) to.loopAttenuation = this.stream.readByte() / 255.0;
          if (bitsHigh & U_OWNER_HIGH) to.owner = this.stream.readShort();
          if (bitsHigh & U_OLD_FRAME_HIGH) to.oldFrame = this.stream.readShort();
      }
  }
}
