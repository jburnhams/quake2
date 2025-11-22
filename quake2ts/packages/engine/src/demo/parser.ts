import { BinaryStream } from '@quake2ts/shared';
import { ServerCommand } from '@quake2ts/shared';
import { Vec3 } from '@quake2ts/shared';
import { TempEntity } from '@quake2ts/shared';

// Constants from Q2 source
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

  constructor(stream: BinaryStream) {
    this.stream = stream;
  }

  public parseMessage(): void {
    while (this.stream.hasMore()) {
      const cmd = this.stream.readByte();

      if (cmd === -1) {
        break;
      }

      switch (cmd) {
        case ServerCommand.nop:
          break;
        case ServerCommand.disconnect:
          console.log("Server disconnected");
          break;
        case ServerCommand.reconnect:
          console.log("Server reconnect");
          break;
        case ServerCommand.print:
          const printId = this.stream.readByte();
          const printMsg = this.stream.readString();
          console.log(`[Server Print ${printId}]: ${printMsg}`);
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
          const centerMsg = this.stream.readString();
          console.log(`[Center Print]: ${centerMsg}`);
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
        case ServerCommand.stufftext:
          const text = this.stream.readString();
          console.log(`[StuffText]: ${text}`);
          break;
        case ServerCommand.layout:
          const layout = this.stream.readString();
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
          console.warn(`Unknown server command: ${cmd}`);
          // If we hit an unknown command, we are likely desynced as we don't know the length to skip.
          return;
      }
    }
  }

  private parseServerData(): void {
    const protocol = this.stream.readLong();
    const serverCount = this.stream.readLong();
    const attractLoop = this.stream.readByte();
    const gameDir = this.stream.readString();
    const playerNum = this.stream.readShort();
    const levelName = this.stream.readString();

    console.log(`Server Data: Protocol ${protocol}, Level ${levelName}, GameDir ${gameDir}`);
  }

  private parseConfigString(): void {
    const index = this.stream.readShort();
    const str = this.stream.readString();
    // In a real implementation, this would update the client's configstring table
  }

  private parseDownload(): void {
    const size = this.stream.readShort();
    const percent = this.stream.readByte();
    if (size > 0) {
        this.stream.readData(size);
    }
  }

  private parseInventory(): void {
    // MAX_ITEMS is 256 in q_shared.h usually
    // In cl_parse.c CL_ParseInventory:
    // int i;
    // for (i=0 ; i<MAX_ITEMS ; i++)
    //   cl.inventory[i] = MSG_ReadShort (&net_message);
    const MAX_ITEMS = 256;
    for (let i = 0; i < MAX_ITEMS; i++) {
        this.stream.readShort();
    }
  }

  private parseSound(): void {
     const flags = this.stream.readByte();
     const soundNum = this.stream.readByte();

     if (flags & 1) { // SND_VOLUME
         this.stream.readByte();
     }
     if (flags & 2) { // SND_ATTENUATION
         this.stream.readByte();
     }
     if (flags & 16) { // SND_OFFSET
         this.stream.readByte();
     }
     if (flags & 8) { // SND_ENT
         this.stream.readShort();
     }
     if (flags & 4) { // SND_POS
         // We need a temporary object to read into
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

      // Placeholder vars
      const pos = { x: 0, y: 0, z: 0 };
      const pos2 = { x: 0, y: 0, z: 0 };
      const dir = { x: 0, y: 0, z: 0 };

      switch (type) {
        case TempEntity.BLOOD:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.GUNSHOT:
        case TempEntity.SPARKS:
        case TempEntity.BULLET_SPARKS:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.SCREEN_SPARKS:
        case TempEntity.SHIELD_SPARKS:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.SHOTGUN:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.SPLASH:
            this.stream.readByte(); // cnt
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            this.stream.readByte(); // r
            break;

        case TempEntity.LASER_SPARKS:
            this.stream.readByte(); // cnt
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            this.stream.readByte(); // color
            break;

        case TempEntity.BLUEHYPERBLASTER:
            this.stream.readPos(pos);
            this.stream.readPos(dir); // NOTE: original uses MSG_ReadPos for dir here
            break;

        case TempEntity.BLASTER:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.RAILTRAIL:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            break;

        case TempEntity.EXPLOSION2:
        case TempEntity.GRENADE_EXPLOSION:
        case TempEntity.GRENADE_EXPLOSION_WATER:
            this.stream.readPos(pos);
            break;

        case TempEntity.PLASMA_EXPLOSION:
            this.stream.readPos(pos);
            break;

        case TempEntity.EXPLOSION1:
        case TempEntity.EXPLOSION1_BIG:
        case TempEntity.ROCKET_EXPLOSION:
        case TempEntity.ROCKET_EXPLOSION_WATER:
        case TempEntity.EXPLOSION1_NP:
            this.stream.readPos(pos);
            break;

        case TempEntity.BFG_EXPLOSION:
            this.stream.readPos(pos);
            break;

        case TempEntity.BFG_BIGEXPLOSION:
            this.stream.readPos(pos);
            break;

        case TempEntity.BFG_LASER:
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            break;

        case TempEntity.BUBBLETRAIL:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            break;

        case TempEntity.PARASITE_ATTACK:
        case TempEntity.MEDIC_CABLE_ATTACK:
            this.stream.readShort(); // ent
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            break;

        case TempEntity.BOSSTPORT:
            this.stream.readPos(pos);
            break;

        case TempEntity.GRAPPLE_CABLE:
            this.stream.readShort(); // ent
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            this.stream.readPos(dir); // offset (reusing dir var)
            break;

        case TempEntity.WELDING_SPARKS:
            this.stream.readByte(); // cnt
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            this.stream.readByte(); // color
            break;

        case TempEntity.GREENBLOOD:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.TUNNEL_SPARKS:
            this.stream.readByte(); // cnt
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            this.stream.readByte(); // color
            break;

        case TempEntity.BLASTER2:
        case TempEntity.FLECHETTE:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.LIGHTNING:
            this.stream.readShort(); // srcEnt
            this.stream.readShort(); // destEnt
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            break;

        case TempEntity.DEBUGTRAIL:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            break;

        case TempEntity.PLAIN_EXPLOSION:
            this.stream.readPos(pos);
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

        case TempEntity.HEATBEAM:
            this.stream.readShort(); // ent
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            this.stream.readPos(dir); // offset
            break;

        case TempEntity.MONSTER_HEATBEAM:
            this.stream.readShort(); // ent
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            this.stream.readPos(dir); // offset
            break;

        case TempEntity.HEATBEAM_SPARKS:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.HEATBEAM_STEAM:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.STEAM:
            const steamId = this.stream.readShort();
            if (steamId !== -1) {
                this.stream.readByte(); // count
                this.stream.readPos(pos);
                this.stream.readDir(dir);
                this.stream.readByte(); // r
                this.stream.readShort(); // magnitude
                this.stream.readLong(); // endtime (delta?) or something
            } else {
                this.stream.readByte(); // cnt
                this.stream.readPos(pos);
                this.stream.readDir(dir);
                this.stream.readByte(); // r
                this.stream.readShort(); // magnitude
            }
            break;

        case TempEntity.BUBBLETRAIL2:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            break;

        case TempEntity.MOREBLOOD:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.CHAINFIST_SMOKE:
            this.stream.readPos(pos);
            break;

        case TempEntity.ELECTRIC_SPARKS:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.TRACKER_EXPLOSION:
            this.stream.readPos(pos);
            break;

        case TempEntity.TELEPORT_EFFECT:
        case TempEntity.DBALL_GOAL:
            this.stream.readPos(pos);
            break;

        case TempEntity.WIDOWBEAMOUT:
            const wbId = this.stream.readShort();
            // Logic from CL_ParseWidow:
            // if free sustain -> reads id, pos, endtime=time+2100...
            // else -> read pos
            // BUT WE ARE PARSING, NOT SIMULATING. We must read exactly what is on the wire.
            // CL_ParseWidow logic:
            // id = MSG_ReadShort
            // if (free_sustain) { MSG_ReadPos... } else { MSG_ReadPos... }
            // It always reads a pos.
            this.stream.readPos(pos);
            break;

        case TempEntity.NUKEBLAST:
            // Logic from CL_ParseNuke:
            // Always reads pos.
            this.stream.readPos(pos);
            break;

        case TempEntity.WIDOWSPLASH:
            this.stream.readPos(pos);
            break;

        default:
            console.warn(`CL_ParseTEnt: bad type ${type}`);
            break;
      }
  }

  private parseSpawnBaseline(): void {
    const bits = this.parseEntityBits();
    // We would use this to update the baseline table
    // const entityState = createEmptyEntityState();
    // this.parseDelta(createEmptyEntityState(), entityState, bits.number, bits.bits);

    // For now just consume the delta
    this.parseDelta(createEmptyEntityState(), createEmptyEntityState(), bits.number, bits.bits);
  }

  private parseFrame(): void {
      const serverFrame = this.stream.readLong();
      const deltaFrame = this.stream.readLong();
      const surpressCount = this.stream.readByte(); // Only if protocol != 26? In cl_parse.c: if (cls.serverProtocol != 26) cl.surpressCount = MSG_ReadByte...
      // But we don't track protocol version here yet. Standard Q2 is 34. So we read it.

      const areaBytes = this.stream.readByte();
      this.stream.readData(areaBytes);

      // The frame command is followed by other commands like svc_playerinfo and svc_packetentities inside the same message block usually?
      // No, svc_frame is a command inside the loop.
      // cl_parse.c CL_ParseFrame calls CL_ParsePlayerstate etc, but those read from net_message.
      // Wait, in CL_ParseFrame, it reads area bits, THEN:
      // cmd = MSG_ReadByte
      // if (cmd != svc_playerinfo) Error
      // ...
      // cmd = MSG_ReadByte
      // if (cmd != svc_packetentities) Error

      // So yes, `svc_frame` implies we *expect* `svc_playerinfo` and `svc_packetentities` next.
      // But my main loop dispatch handles them as separate commands if I return?
      // No, `CL_ParseFrame` *consumes* them.

      // So I must consume them here.

      // Player Info
      const piCmd = this.stream.readByte();
      if (piCmd !== ServerCommand.playerinfo) {
          throw new Error(`Expected svc_playerinfo after svc_frame, got ${piCmd}`);
      }
      this.parsePlayerState();

      // Packet Entities
      const peCmd = this.stream.readByte();
      if (peCmd !== ServerCommand.packetentities && peCmd !== ServerCommand.deltapacketentities) {
           throw new Error(`Expected svc_packetentities after svc_playerinfo, got ${peCmd}`);
      }
      this.parsePacketEntities(peCmd === ServerCommand.deltapacketentities);
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

      // PS_BLEND (1<<10) (Note: skipped WEAPONINDEX/FRAME in headers, check full list order)
      // Header says:
      // #define	PS_WEAPONINDEX		(1<<12)
      // #define	PS_WEAPONFRAME		(1<<13)
      // #define	PS_BLEND			(1<<10)
      // #define	PS_FOV				(1<<11)
      // #define	PS_RDFLAGS			(1<<14)

      // Order in CL_ParsePlayerstate:
      // WEAPONINDEX
      if (flags & 4096) this.stream.readByte();

      // WEAPONFRAME
      if (flags & 8192) {
          this.stream.readByte(); // frame
          this.stream.readChar(); // offset x
          this.stream.readChar(); // offset y
          this.stream.readChar(); // offset z
          this.stream.readChar(); // angles x
          this.stream.readChar(); // angles y
          this.stream.readChar(); // angles z
      }

      // BLEND
      if (flags & 1024) {
          this.stream.readByte();
          this.stream.readByte();
          this.stream.readByte();
          this.stream.readByte();
      }

      // FOV
      if (flags & 2048) this.stream.readByte();

      // RDFLAGS
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
      // In CL_ParsePacketEntities
      while (true) {
          const bits = this.parseEntityBits();
          if (bits.number === 0) {
              break;
          }

          // Consume the delta
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
      // Copy 'from' to 'to'
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
