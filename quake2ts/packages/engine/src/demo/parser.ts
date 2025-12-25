
// Rerelease Protocol Impl
import { BinaryStream, Vec3, ServerCommand, TempEntity, ANORMS } from '@quake2ts/shared';
import {
    U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1,
    U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2,
    U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3,
    U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_MOREBITS4,
    U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH
} from '@quake2ts/shared';
import pako from 'pako';
import { StreamingBuffer } from '../stream/streamingBuffer.js';
import { ProtocolHandler } from './protocol/types.js';
import { createProtocolHandler, BootstrapProtocolHandler } from './protocol/factory.js';
import { PROTOCOL_VERSION_RERELEASE } from './protocol/rerelease.js';
import { EntityState, ProtocolPlayerState, createEmptyEntityState, createEmptyProtocolPlayerState, MutableVec3, FrameData, FogData, DamageIndicator } from './state.js';

// Export constants for other modules (Writer etc)
export {
    U_ORIGIN1, U_ORIGIN2, U_ANGLE2, U_ANGLE3, U_FRAME8, U_EVENT, U_REMOVE, U_MOREBITS1,
    U_NUMBER16, U_ORIGIN3, U_ANGLE1, U_MODEL, U_RENDERFX8, U_ALPHA, U_EFFECTS8, U_MOREBITS2,
    U_SKIN8, U_FRAME16, U_RENDERFX16, U_EFFECTS16, U_MODEL2, U_MODEL3, U_MODEL4, U_MOREBITS3,
    U_OLDORIGIN, U_SKIN16, U_SOUND, U_SOLID, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_MOREBITS4,
    U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH
} from '@quake2ts/shared'; // Re-export from shared

// Export types and factories
export {
    EntityState,
    ProtocolPlayerState,
    createEmptyEntityState,
    createEmptyProtocolPlayerState,
    MutableVec3,
    FrameData,
    FogData,
    DamageIndicator,
    PROTOCOL_VERSION_RERELEASE
};

const RECORD_NETWORK = 0x00;
const RECORD_CLIENT  = 0x01;
const RECORD_SERVER  = 0x02;
const RECORD_RELAY   = 0x80;

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

export class NetworkMessageParser {
  private stream: StreamingBuffer;
  private handler?: NetworkMessageHandler;
  private strictMode: boolean = false;
  private errorCount: number = 0;

  private protocolHandler: ProtocolHandler;
  private isDemo: number = RECORD_CLIENT;

  constructor(stream: StreamingBuffer | BinaryStream, handler?: NetworkMessageHandler, strictMode: boolean = false) {
    if (stream instanceof BinaryStream) {
        this.stream = new BinaryStreamAdapter(stream);
    } else {
        this.stream = stream;
    }
    this.handler = handler;
    this.strictMode = strictMode;
    this.protocolHandler = new BootstrapProtocolHandler();
  }

  public setProtocolVersion(version: number): void {
      if (this.protocolHandler.protocolVersion !== version) {
          this.protocolHandler = createProtocolHandler(version);
      }
  }

  public getProtocolVersion(): number {
      return this.protocolHandler.protocolVersion;
  }

  public getErrorCount(): number {
      return this.errorCount;
  }

  public parseMessage(): void {
    while (this.stream.hasBytes(1)) {
      const startPos = this.stream.getReadPosition();
      let cmd = -1;

      try {
        cmd = this.stream.readByte();

        if (cmd === -1) break;

        const originalCmd = cmd;
        const translatedCmd = this.protocolHandler.translateCommand(cmd);

        switch (translatedCmd) {
          case ServerCommand.bad:
            // Allow 0 as padding (standard in demos)
            if (originalCmd === 0) {
                return;
            }
            // Treat anything else translating to BAD as an error
            const errorMsg = `Unknown server command: ${originalCmd} (translated: ${translatedCmd}) at offset ${startPos} (Protocol: ${this.getProtocolVersion()})`;
            if (this.strictMode) throw new Error(errorMsg);
            console.warn(errorMsg);
            this.errorCount++;
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
            const errorMsgDef = `Unknown server command: ${originalCmd} (translated: ${translatedCmd}) at offset ${startPos}`;
            if (this.strictMode) throw new Error(errorMsgDef);
            console.warn(errorMsgDef);
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

          const context = `offset ${startPos}, cmd ${cmd}, protocol ${this.getProtocolVersion()}`;
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
    const data = this.protocolHandler.parseServerData(this.stream);

    // Switch Protocol Handler
    this.setProtocolVersion(data.protocol);

    if (this.handler) {
        this.handler.onServerData(
            data.protocol,
            data.serverCount,
            data.attractLoop,
            data.gameDir,
            data.playerNum,
            data.levelName,
            data.tickRate,
            data.demoType
        );
    }

    // Set Demo Flag
    if (data.protocol === PROTOCOL_VERSION_RERELEASE) {
        this.isDemo = data.demoType ?? RECORD_CLIENT;
    } else {
        this.isDemo = data.attractLoop;
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
          blastParser.setProtocolVersion(this.getProtocolVersion());
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
            if (this.getProtocolVersion() >= 32) { this.readPos(pos); this.readPos(pos2); } else { this.readPos(pos); this.readDir(dir); } break;
        case TempEntity.GREENBLOOD:
            if (this.getProtocolVersion() >= 32) { this.readPos(pos); this.readDir(dir); } else { this.readPos(pos); this.readPos(pos2); } break;
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
    const bits = this.protocolHandler.parseEntityBits(this.stream);
    const entity = createEmptyEntityState();
    this.protocolHandler.parseDelta(createEmptyEntityState(), entity, bits.number, bits.bits, bits.bitsHigh, this.stream);
    if (this.handler) this.handler.onSpawnBaseline(entity);
  }

  private parseFrame(): void {
      const serverFrame = this.stream.readLong();
      const deltaFrame = this.stream.readLong();
      let surpressCount = 0;

      if (this.getProtocolVersion() !== 26 && this.getProtocolVersion() !== 25) {
          surpressCount = this.stream.readByte();
      }

      const areaBytes = this.stream.readByte();
      const areaBits = this.stream.readData(areaBytes);

      let piCmd = this.stream.readByte();
      piCmd = this.protocolHandler.translateCommand(piCmd);
      if (piCmd !== ServerCommand.playerinfo) {
          if (this.strictMode) throw new Error(`Expected svc_playerinfo after svc_frame, got ${piCmd}`);
          return;
      }
      const playerState = this.parsePlayerState();

      let peCmd = this.stream.readByte();
      peCmd = this.protocolHandler.translateCommand(peCmd);
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
      return this.protocolHandler.parsePlayerState(this.stream);
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
          const bits = this.protocolHandler.parseEntityBits(this.stream);
          if (bits.bits & U_REMOVE) {
              if (bits.number === 0) break;
              continue;
          }
          const entity = createEmptyEntityState();

          if (bits.number === 0) {
              break;
          }

          this.protocolHandler.parseDelta(createEmptyEntityState(), entity, bits.number, bits.bits, bits.bitsHigh, this.stream);
          entities.push(entity);
      }
      return entities;
  }
}
