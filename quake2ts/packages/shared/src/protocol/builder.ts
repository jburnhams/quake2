import { BinaryWriter } from '../io/binaryWriter.js';
import { ServerCommand, ClientCommand } from './ops.js';
import { TempEntity } from './tempEntity.js';
import { ProtocolPlayerState } from './player-state.js'; // Assuming this is where it is, or define interface
// Note: ProtocolPlayerState is in parser.ts in engine, but usually shared types should be in shared.
// For now, I'll assume we can pass the data structure.

export class NetworkMessageBuilder {
  private writer: BinaryWriter;

  constructor(writer?: BinaryWriter) {
    this.writer = writer || new BinaryWriter();
  }

  public getWriter(): BinaryWriter {
    return this.writer;
  }

  public getData(): Uint8Array {
    return this.writer.getData();
  }

  public reset(): void {
    this.writer.reset();
  }

  // Generic writes
  public writeByte(val: number) { this.writer.writeByte(val); }
  public writeShort(val: number) { this.writer.writeShort(val); }
  public writeLong(val: number) { this.writer.writeLong(val); }
  public writeFloat(val: number) { this.writer.writeFloat(val); }
  public writeString(str: string) { this.writer.writeString(str); }
  public writeCoord(val: number) { this.writer.writeCoord(val); }
  public writeAngle(val: number) { this.writer.writeAngle(val); }
  public writeAngle16(val: number) { this.writer.writeAngle16(val); }
  public writeData(data: Uint8Array) { this.writer.writeData(data); }

  // Server Commands
  public writeServerNop(): void {
    this.writer.writeByte(ServerCommand.nop);
  }

  public writeServerDisconnect(): void {
    this.writer.writeByte(ServerCommand.disconnect);
  }

  public writeServerReconnect(): void {
    this.writer.writeByte(ServerCommand.reconnect);
  }

  public writeServerPrint(level: number, text: string): void {
    this.writer.writeByte(ServerCommand.print);
    this.writer.writeByte(level);
    this.writer.writeString(text);
  }

  public writeServerCenterPrint(text: string): void {
    this.writer.writeByte(ServerCommand.centerprint);
    this.writer.writeString(text);
  }

  public writeServerStuffText(text: string): void {
    this.writer.writeByte(ServerCommand.stufftext);
    this.writer.writeString(text);
  }

  public writeServerConfigString(index: number, text: string): void {
    this.writer.writeByte(ServerCommand.configstring);
    this.writer.writeShort(index);
    this.writer.writeString(text);
  }

  public writeServerData(
    protocolVersion: number,
    serverCount: number,
    attractLoop: boolean,
    gameDir: string,
    playerNum: number,
    levelName: string
  ): void {
    this.writer.writeByte(ServerCommand.serverdata);
    this.writer.writeLong(protocolVersion);
    this.writer.writeLong(serverCount);
    this.writer.writeByte(attractLoop ? 1 : 0);
    this.writer.writeString(gameDir);
    this.writer.writeShort(playerNum);
    this.writer.writeString(levelName);
  }

  public writeServerDownload(size: number, percent: number, data?: Uint8Array): void {
    this.writer.writeByte(ServerCommand.download);
    this.writer.writeShort(size);
    this.writer.writeByte(percent);
    if (size > 0 && data) {
      this.writer.writeData(data);
    }
  }

  public writeServerInventory(items: number[]): void {
    this.writer.writeByte(ServerCommand.inventory);
    // Inventory is fixed size MAX_ITEMS = 256 shorts in parser
    for (let i = 0; i < 256; i++) {
        this.writer.writeShort(items[i] || 0);
    }
  }

  public writeServerTempEntity(
    type: number,
    pos: { x: number; y: number; z: number },
    pos2?: { x: number; y: number; z: number },
    dir?: { x: number; y: number; z: number },
    cnt?: number,
    color?: number,
    ent?: number,
    srcEnt?: number,
    destEnt?: number
  ): void {
    this.writer.writeByte(ServerCommand.temp_entity);
    this.writer.writeByte(type);

    // This switch logic must match parseTempEntity in parser.ts
    // For brevity, I am implementing common ones.
    // Ideally this logic should be shared or derived from a table.
    switch (type) {
        case TempEntity.EXPLOSION1:
        case TempEntity.EXPLOSION2:
        case TempEntity.ROCKET_EXPLOSION:
        case TempEntity.GRENADE_EXPLOSION:
        case TempEntity.ROCKET_EXPLOSION_WATER:
        case TempEntity.GRENADE_EXPLOSION_WATER:
        case TempEntity.BFG_EXPLOSION:
        case TempEntity.BFG_BIGEXPLOSION:
        case TempEntity.BOSSTPORT:
        case TempEntity.PLASMA_EXPLOSION:
        case TempEntity.PLAIN_EXPLOSION:
        case TempEntity.CHAINFIST_SMOKE:
        case TempEntity.TRACKER_EXPLOSION:
        case TempEntity.TELEPORT_EFFECT:
        case TempEntity.DBALL_GOAL:
        case TempEntity.NUKEBLAST:
        case TempEntity.WIDOWSPLASH:
        case TempEntity.EXPLOSION1_BIG:
        case TempEntity.EXPLOSION1_NP:
            this.writer.writePos(pos);
            break;

        case TempEntity.GUNSHOT:
        case TempEntity.BLOOD:
        case TempEntity.BLASTER:
        case TempEntity.SHOTGUN:
        case TempEntity.SPARKS:
        case TempEntity.BULLET_SPARKS:
        case TempEntity.SCREEN_SPARKS:
        case TempEntity.SHIELD_SPARKS:
        case TempEntity.BLASTER2:
        case TempEntity.FLECHETTE:
        case TempEntity.MOREBLOOD:
        case TempEntity.ELECTRIC_SPARKS:
        case TempEntity.HEATBEAM_SPARKS:
        case TempEntity.HEATBEAM_STEAM:
            this.writer.writePos(pos);
            this.writer.writeDir(dir || {x:0,y:0,z:0});
            break;

         // Add others as needed...
         // This can be expanded later.
    }
  }


  // Client Commands
  public writeClientNop(): void {
    this.writer.writeByte(ClientCommand.nop);
  }

  public writeClientStringCmd(msg: string): void {
    this.writer.writeByte(ClientCommand.stringcmd);
    this.writer.writeString(msg);
  }

  public writeClientUserInfo(userInfo: string): void {
    this.writer.writeByte(ClientCommand.userinfo);
    this.writer.writeString(userInfo);
  }

  // Move command is complex (usercmd), will implement later or separate method
}
