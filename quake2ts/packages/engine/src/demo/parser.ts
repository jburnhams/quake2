import { BinaryStream } from '@quake2ts/shared';
import { ServerCommand } from '@quake2ts/shared';
import { TempEntity } from '@quake2ts/shared';
import { ANORMS } from '@quake2ts/shared/src/math/anorms.js';

// Constants from Q2 source (q_shared.h)
const U_ORIGIN1   = (1 << 0);
const U_ORIGIN2   = (1 << 1);
const U_ANGLE2    = (1 << 2);
const U_ANGLE3    = (1 << 3);
const U_FRAME8    = (1 << 4);
const U_EVENT     = (1 << 5);
const U_REMOVE    = (1 << 6);
const U_MOREBITS1 = (1 << 7);

const U_NUMBER16  = (1 << 8);
const U_ORIGIN3   = (1 << 9);
const U_ANGLE1    = (1 << 10);
const U_MODEL     = (1 << 11);
const U_RENDERFX8 = (1 << 12);
const U_EFFECTS8  = (1 << 14);
const U_MOREBITS2 = (1 << 15);

const U_SKIN8     = (1 << 16);
const U_FRAME16   = (1 << 17);
const U_RENDERFX16 = (1 << 18);
const U_EFFECTS16 = (1 << 19);
const U_MODEL2    = (1 << 20);
const U_MODEL3    = (1 << 21);
const U_MODEL4    = (1 << 22);
const U_MOREBITS3 = (1 << 23);

const U_OLDORIGIN = (1 << 24);
const U_SKIN16    = (1 << 25);
const U_SOUND     = (1 << 26);
const U_SOLID     = (1 << 27);

// Demo types
const RECORD_NETWORK = 0x00;
const RECORD_CLIENT  = 0x01;
const RECORD_SERVER  = 0x02;
const RECORD_RELAY   = 0x80;

// Mutable Vec3 for internal use
interface MutableVec3 {
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
  solid: 0
});

export class NetworkMessageParser {
  private stream: BinaryStream;
  private protocolVersion: number = 0; // 0 = unknown, will be set by serverdata
  private isDemo: number = RECORD_CLIENT;

  constructor(stream: BinaryStream) {
    this.stream = stream;
  }

  private translateCommand(cmd: number): number {
    // If protocol is unknown, we guess based on first command?
    // Or if protocol is 25, we map.

    // Auto-detect Proto 25 if we see 7 as first command?
    if (this.protocolVersion === 0) {
        if (cmd === 7) {
            // Assume Proto 25 ServerData
            return ServerCommand.serverdata;
        }
        if (cmd === 12) {
            return ServerCommand.serverdata;
        }
    }

    if (this.protocolVersion === 25) {
        // Hypothesis: Shift by 5 for high commands
        // 7 -> 12 (serverdata)
        // 8 -> 13 (configstring)
        // 9 -> 14 (spawnbaseline)
        // 10 -> 15 (centerprint)
        // 11 -> 16 (download)
        // 12 -> 17 (playerinfo)
        // 13 -> 18 (packetentities)
        // 14 -> 19 (deltapacketentities)
        // 15 -> 20 (frame)
        if (cmd >= 7 && cmd <= 15) {
            return cmd + 5;
        }

        // Low commands?
        // 1 -> print (10)?
        // 2 -> stufftext (11)?
        // 3 -> sound (9)?
        // 4 -> nop (6)?
        // 5 -> disconnect (7)?
        // 6 -> reconnect (8)?
        if (cmd === 1) return ServerCommand.print;
        if (cmd === 2) return ServerCommand.stufftext;
        if (cmd === 3) return ServerCommand.sound;
        if (cmd === 4) return ServerCommand.nop;
        // 5 (disconnect) matches 7 in new? No, 7 is disconnect in new.
        // If 7 is serverdata in old, then disconnect must be < 7.
        if (cmd === 5) return ServerCommand.disconnect;
        if (cmd === 6) return ServerCommand.reconnect;

        // TempEntity?
        // If it was 16?
        if (cmd === 16) return ServerCommand.temp_entity;
    }

    return cmd;
  }

  public parseMessage(): void {
    while (this.stream.hasMore()) {
      let cmd = this.stream.readByte();

      if (cmd === -1) {
        break;
      }

      const originalCmd = cmd;
      cmd = this.translateCommand(cmd);

      try {
        switch (cmd) {
          case ServerCommand.nop:
            break;
          case ServerCommand.disconnect:
            // console.log("Server disconnected");
            break;
          case ServerCommand.reconnect:
            // console.log("Server reconnect");
            break;
          case ServerCommand.print:
            this.parsePrint();
            break;
          case ServerCommand.serverdata:
            this.parseServerData();
            break;
          case ServerCommand.configstring:
            this.parseConfigString();
            break;
          case ServerCommand.spawnbaseline:
            this.parseSpawnBaseline();
            break;
          case ServerCommand.centerprint:
            this.parseCenterPrint();
            break;
          case ServerCommand.download:
             this.parseDownload();
             break;
          case ServerCommand.frame:
             this.parseFrame();
             break;
          case ServerCommand.packetentities:
             this.parsePacketEntities(false);
             break;
          case ServerCommand.deltapacketentities:
             this.parsePacketEntities(true);
             break;
          case ServerCommand.playerinfo:
             this.parsePlayerState();
             break;
          case ServerCommand.stufftext:
            this.parseStuffText();
            break;
          case ServerCommand.layout:
            this.parseLayout();
            break;
          case ServerCommand.inventory:
             this.parseInventory();
             break;
          case ServerCommand.sound:
             this.parseSound();
             break;
          case ServerCommand.muzzleflash:
             this.parseMuzzleFlash();
             break;
          case ServerCommand.muzzleflash2:
             this.parseMuzzleFlash2();
             break;
          case ServerCommand.temp_entity:
             this.parseTempEntity();
             break;
          default:
            console.warn(`Unknown server command: ${originalCmd} (translated: ${cmd}) at offset ${this.stream.getPosition() - 1}`);
            return;
        }
      } catch (e) {
          console.warn(`Error parsing command ${cmd}: ${(e as Error).message}`);
          return;
      }
    }
  }

  private parsePrint(): void {
      const id = this.stream.readByte();
      const str = this.stream.readString();
  }

  private parseStuffText(): void {
      const text = this.stream.readString();
  }

  private parseLayout(): void {
      const layout = this.stream.readString();
  }

  private parseCenterPrint(): void {
      const centerMsg = this.stream.readString();
  }

  private parseServerData(): void {
    this.protocolVersion = this.stream.readLong();
    const serverCount = this.stream.readLong();
    this.isDemo = this.stream.readByte();
    const gameDir = this.stream.readString();
    const playerNum = this.stream.readShort();
    const levelName = this.stream.readString();
  }

  private parseConfigString(): void {
    const index = this.stream.readShort();
    const str = this.stream.readString();
  }

  private parseDownload(): void {
    const size = this.stream.readShort();
    const percent = this.stream.readByte();
    if (size > 0) {
        this.stream.readData(size);
    }
  }

  private parseInventory(): void {
    const MAX_ITEMS = 256;
    for (let i = 0; i < MAX_ITEMS; i++) {
        this.stream.readShort();
    }
  }

  private parseSound(): void {
     const mask = this.stream.readByte();
     const soundNum = this.stream.readByte();

     if (mask & 1) { // SND_VOLUME
         this.stream.readByte();
     }
     if (mask & 2) { // SND_ATTENUATION
         this.stream.readByte();
     }
     if (mask & 16) { // SND_OFFSET
         this.stream.readByte();
     }
     if (mask & 8) { // SND_ENT
         this.stream.readShort();
     }
     if (mask & 4) { // SND_POS
         const pos = { x: 0, y: 0, z: 0 };
         this.stream.readPos(pos);
     }
  }

  private parseMuzzleFlash(): void {
     const ent = this.stream.readShort();
     const weapon = this.stream.readByte();
  }

  private parseMuzzleFlash2(): void {
     const ent = this.stream.readShort();
     const weapon = this.stream.readByte();
  }

  private parseTempEntity(): void {
      const type = this.stream.readByte();

      const pos = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 0, y: 0, z: 0 };
      const dir = { x: 0, y: 0, z: 0 };

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
            this.stream.readPos(pos);
            break;

        case TempEntity.GUNSHOT:
        case TempEntity.BLOOD:
        case TempEntity.BLASTER:
        case TempEntity.SHOTGUN:
        case TempEntity.SPARKS:
        case TempEntity.SCREEN_SPARKS:
        case TempEntity.SHIELD_SPARKS:
        case TempEntity.BULLET_SPARKS:
        case TempEntity.BLASTER2:
        case TempEntity.MOREBLOOD:
        case TempEntity.HEATBEAM_SPARKS:
        case TempEntity.HEATBEAM_STEAM:
        case TempEntity.ELECTRIC_SPARKS:
        case TempEntity.FLECHETTE:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.RAILTRAIL:
        case TempEntity.BUBBLETRAIL:
        case TempEntity.BFG_LASER:
        case TempEntity.DEBUGTRAIL:
        case TempEntity.BUBBLETRAIL2:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            break;

        case TempEntity.BLUEHYPERBLASTER:
            if (this.protocolVersion >= 32) {
                 this.stream.readPos(pos);
                 this.stream.readPos(pos2);
            } else {
                 this.stream.readPos(pos);
                 this.stream.readDir(dir);
            }
            break;

        case TempEntity.GREENBLOOD: // 26
            if (this.protocolVersion >= 32) {
                this.stream.readPos(pos);
                this.stream.readDir(dir);
            } else {
                this.stream.readPos(pos);
                this.stream.readPos(pos2);
            }
            break;

        case TempEntity.SPLASH:
        case TempEntity.LASER_SPARKS:
        case TempEntity.WELDING_SPARKS:
        case TempEntity.TUNNEL_SPARKS:
            this.stream.readByte(); // count
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            this.stream.readByte(); // color/style
            break;

        case TempEntity.PARASITE_ATTACK:
        case TempEntity.MEDIC_CABLE_ATTACK:
        case TempEntity.HEATBEAM:
        case TempEntity.MONSTER_HEATBEAM:
            this.stream.readShort(); // ent
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            break;

        case TempEntity.GRAPPLE_CABLE:
            this.stream.readShort(); // ent
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            this.stream.readPos(dir); // offset
            break;

        case TempEntity.FLASHLIGHT:
            this.stream.readPos(pos);
            this.stream.readShort(); // ent
            break;

        case TempEntity.FORCEWALL:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            this.stream.readByte(); // color
            break;

        case TempEntity.STEAM:
             const nextId = this.stream.readShort();
             this.stream.readByte(); // count
             this.stream.readPos(pos);
             this.stream.readDir(dir);
             this.stream.readByte(); // r
             this.stream.readShort(); // magnitude
             if (nextId !== -1) {
                 this.stream.readLong(); // wait
             }
             break;

        case TempEntity.WIDOWBEAMOUT:
            this.stream.readShort(); // id
            this.stream.readPos(pos);
            break;

        default:
            // console.warn(`CL_ParseTEnt: bad type ${type}`);
            break;
      }
  }

  private parseSpawnBaseline(): void {
    const bits = this.parseEntityBits();
    this.parseDelta(createEmptyEntityState(), createEmptyEntityState(), bits.number, bits.bits);
  }

  private parseFrame(): void {
      const seq1 = this.stream.readLong();
      const seq2 = this.stream.readLong();

      // Spec says: "if (serverdata.serverversion != 26) uk_b1 = ReadByte;"
      // Protocol 26 (Q2 3.05) is the only one that skips this byte.
      // Protocol 25 (Q2 3.00) and Protocol 34 (Q2 3.20) both include it.
      if (this.protocolVersion !== 26) {
          this.stream.readByte();
      }

      const count = this.stream.readByte();
      if (count > 0) {
        this.stream.readData(count); // areas
      }

      if (this.isDemo === RECORD_RELAY) {
          const connectedCount = this.stream.readByte();
          for(let i=0; i<connectedCount; i++) {
              this.stream.readByte();
          }
      }

      if (this.isDemo === RECORD_SERVER) {
          this.stream.readLong();
      }
  }

  private parsePlayerState(): void {
      const flags = this.stream.readShort();

      // PS_M_TYPE (1<<0)
      if (flags & 1) this.stream.readByte();

      // PS_M_ORIGIN (1<<1)
      if (flags & 2) {
          this.stream.readShort();
          this.stream.readShort();
          this.stream.readShort();
      }

      // PS_M_VELOCITY (1<<2)
      if (flags & 4) {
          this.stream.readShort();
          this.stream.readShort();
          this.stream.readShort();
      }

      // PS_M_TIME (1<<3)
      if (flags & 8) this.stream.readByte();

      // PS_M_FLAGS (1<<4)
      if (flags & 16) this.stream.readByte();

      // PS_M_GRAVITY (1<<5)
      if (flags & 32) this.stream.readShort();

      // PS_M_DELTA_ANGLES (1<<6)
      if (flags & 64) {
          this.stream.readShort();
          this.stream.readShort();
          this.stream.readShort();
      }

      // PS_VIEWOFFSET (1<<7)
      if (flags & 128) {
          this.stream.readChar();
          this.stream.readChar();
          this.stream.readChar();
      }

      // PS_VIEWANGLES (1<<8)
      if (flags & 256) {
          this.stream.readAngle16();
          this.stream.readAngle16();
          this.stream.readAngle16();
      }

      // PS_KICKANGLES (1<<9)
      if (flags & 512) {
          this.stream.readChar();
          this.stream.readChar();
          this.stream.readChar();
      }

      // WEAPONINDEX (1<<12)
      if (flags & 4096) this.stream.readByte();

      // WEAPONFRAME (1<<13)
      if (flags & 8192) {
          this.stream.readByte(); // frame
          this.stream.readChar(); // offset x
          this.stream.readChar(); // offset y
          this.stream.readChar(); // offset z
          this.stream.readChar(); // angles x
          this.stream.readChar(); // angles y
          this.stream.readChar(); // angles z
      }

      // BLEND (1<<10)
      if (flags & 1024) {
          this.stream.readByte();
          this.stream.readByte();
          this.stream.readByte();
          this.stream.readByte();
      }

      // FOV (1<<11)
      if (flags & 2048) this.stream.readByte();

      // RDFLAGS (1<<14)
      if (flags & 16384) this.stream.readByte();

      // STATS
      const statbits = this.stream.readLong();
      for (let i = 0; i < 32; i++) {
          if (statbits & (1 << i)) {
              this.stream.readShort();
          }
      }
  }

  private parsePacketEntities(delta: boolean): void {
      while (true) {
          const bits = this.parseEntityBits();
          if (bits.number === 0) {
              break;
          }
          this.parseDelta(createEmptyEntityState(), createEmptyEntityState(), bits.number, bits.bits);
      }
  }

  private parseEntityBits(): { number: number; bits: number } {
      let total = this.stream.readByte();
      if (total & U_MOREBITS1) {
          total |= (this.stream.readByte() << 8);
      }
      if (total & U_MOREBITS2) {
          total |= (this.stream.readByte() << 16);
      }
      if (total & U_MOREBITS3) {
          total |= (this.stream.readByte() << 24);
      }

      let number: number;
      if (total & U_NUMBER16) {
          number = this.stream.readShort();
      } else {
          number = this.stream.readByte();
      }

      return { number, bits: total };
  }

  private parseDelta(from: EntityState, to: EntityState, number: number, bits: number): void {
      to.number = from.number;
      to.modelindex = from.modelindex;
      to.modelindex2 = from.modelindex2;
      to.modelindex3 = from.modelindex3;
      to.modelindex4 = from.modelindex4;
      to.frame = from.frame;
      to.skinnum = from.skinnum;
      to.effects = from.effects;
      to.renderfx = from.renderfx;
      to.origin.x = from.origin.x; to.origin.y = from.origin.y; to.origin.z = from.origin.z;
      to.old_origin.x = from.origin.x; to.old_origin.y = from.origin.y; to.old_origin.z = from.origin.z;
      to.angles.x = from.angles.x; to.angles.y = from.angles.y; to.angles.z = from.angles.z;
      to.sound = from.sound;
      to.event = from.event;
      to.solid = from.solid;

      to.number = number;

      if (bits & U_MODEL) to.modelindex = this.stream.readByte();
      if (bits & U_MODEL2) to.modelindex2 = this.stream.readByte();
      if (bits & U_MODEL3) to.modelindex3 = this.stream.readByte();
      if (bits & U_MODEL4) to.modelindex4 = this.stream.readByte();

      if (bits & U_FRAME8) to.frame = this.stream.readByte();
      if (bits & U_FRAME16) to.frame = this.stream.readShort();

      if ((bits & U_SKIN8) && (bits & U_SKIN16)) {
          to.skinnum = this.stream.readLong();
      } else if (bits & U_SKIN8) {
          to.skinnum = this.stream.readByte();
      } else if (bits & U_SKIN16) {
          to.skinnum = this.stream.readShort();
      }

      if ((bits & U_EFFECTS8) && (bits & U_EFFECTS16)) {
          to.effects = this.stream.readLong();
      } else if (bits & U_EFFECTS8) {
          to.effects = this.stream.readByte();
      } else if (bits & U_EFFECTS16) {
          to.effects = this.stream.readShort();
      }

      if ((bits & U_RENDERFX8) && (bits & U_RENDERFX16)) {
          to.renderfx = this.stream.readLong();
      } else if (bits & U_RENDERFX8) {
          to.renderfx = this.stream.readByte();
      } else if (bits & U_RENDERFX16) {
          to.renderfx = this.stream.readShort();
      }

      if (bits & U_ORIGIN1) to.origin.x = this.stream.readCoord();
      if (bits & U_ORIGIN2) to.origin.y = this.stream.readCoord();
      if (bits & U_ORIGIN3) to.origin.z = this.stream.readCoord();

      if (bits & U_ANGLE1) to.angles.x = this.stream.readAngle();
      if (bits & U_ANGLE2) to.angles.y = this.stream.readAngle();
      if (bits & U_ANGLE3) to.angles.z = this.stream.readAngle();

      if (bits & U_OLDORIGIN) {
          this.stream.readPos(to.old_origin);
      }

      if (bits & U_SOUND) to.sound = this.stream.readByte();

      if (bits & U_EVENT) {
          to.event = this.stream.readByte();
      } else {
          to.event = 0;
      }

      if (bits & U_SOLID) to.solid = this.stream.readShort();
  }
}
