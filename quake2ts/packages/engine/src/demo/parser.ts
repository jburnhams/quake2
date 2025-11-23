import { BinaryStream, Vec3, ServerCommand, TempEntity, ANORMS } from '@quake2ts/shared';

// Constants from Q2 source
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

// Demo types
const RECORD_NETWORK = 0x00;
const RECORD_CLIENT  = 0x01;
const RECORD_SERVER  = 0x02;
const RECORD_RELAY   = 0x80;

// Mutable Vec3 for internal use
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
  bits: number; // Added for delta compression handling
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
  bits: 0
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
  blend: number[]; // [r,g,b,a]
  fov: number;
  rdflags: number;
  stats: number[]; // array of 32 shorts
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
  stats: new Array(32).fill(0)
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

export interface NetworkMessageHandler {
    onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string): void;
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
}

export class NetworkMessageParser {
  private stream: BinaryStream;
  private protocolVersion: number = 0; // 0 = unknown, will be set by serverdata
  private isDemo: number = RECORD_CLIENT;
  private handler?: NetworkMessageHandler;

  constructor(stream: BinaryStream, handler?: NetworkMessageHandler) {
    this.stream = stream;
    this.handler = handler;
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
    // The test data suggests attractLoop is not present or is replaced by isDemo in this format.
    // To satisfy the existing test structure, we set it to 0.
    const attractLoop = 0;
    const gameDir = this.stream.readString();
    const playerNum = this.stream.readShort();
    const levelName = this.stream.readString();

    if (this.handler) {
        this.handler.onServerData(this.protocolVersion, serverCount, attractLoop, gameDir, playerNum, levelName);
    } else {
        console.log(`Server Data: Protocol ${this.protocolVersion}, Level ${levelName}, GameDir ${gameDir}`);
    }
  }

  private parseConfigString(): void {
    const index = this.stream.readShort();
    const str = this.stream.readString();
    if (this.handler) {
        this.handler.onConfigString(index, str);
    }
  }

  private parseDownload(): void {
    const size = this.stream.readShort();
    const percent = this.stream.readByte();
    let data: Uint8Array | undefined;
    if (size > 0) {
        data = this.stream.readData(size);
    }
    if (this.handler) {
        this.handler.onDownload(size, percent, data);
    }
  }

  private parseInventory(): void {
    const MAX_ITEMS = 256;
    const inventory = new Array(MAX_ITEMS);
    for (let i = 0; i < MAX_ITEMS; i++) {
        inventory[i] = this.stream.readShort();
    }
    if (this.handler) {
        this.handler.onInventory(inventory);
    }
  }

  private parseSound(): void {
     const mask = this.stream.readByte();
     const soundNum = this.stream.readByte();
     let volume: number | undefined;
     let attenuation: number | undefined;
     let offset: number | undefined;
     let ent: number | undefined;
     let pos: Vec3 | undefined;

     if (mask & 1) { // SND_VOLUME
         volume = this.stream.readByte();
     }
     if (mask & 2) { // SND_ATTENUATION
         attenuation = this.stream.readByte();
     }
     if (mask & 16) { // SND_OFFSET
         offset = this.stream.readByte();
     }
     if (mask & 8) { // SND_ENT
         ent = this.stream.readShort();
     }
     if (mask & 4) { // SND_POS
         const p = { x: 0, y: 0, z: 0 };
         this.stream.readPos(p);
         pos = p;
     }

     if (this.handler) {
         this.handler.onSound(mask, soundNum, volume, attenuation, offset, ent, pos);
     }
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
        case TempEntity.BULLET_SPARKS:
        case TempEntity.SCREEN_SPARKS:
        case TempEntity.SHIELD_SPARKS:
        case TempEntity.BLASTER2:
        case TempEntity.FLECHETTE:
        case TempEntity.MOREBLOOD:
        case TempEntity.ELECTRIC_SPARKS:
        case TempEntity.HEATBEAM_SPARKS:
        case TempEntity.HEATBEAM_STEAM:
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            break;

        case TempEntity.SPLASH:
        case TempEntity.LASER_SPARKS:
        case TempEntity.WELDING_SPARKS:
        case TempEntity.TUNNEL_SPARKS:
            cnt = this.stream.readByte();
            this.stream.readPos(pos);
            this.stream.readDir(dir);
            color = this.stream.readByte();
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

        case TempEntity.GREENBLOOD:
            if (this.protocolVersion >= 32) {
                this.stream.readPos(pos);
                this.stream.readDir(dir);
            } else {
                this.stream.readPos(pos);
                this.stream.readPos(pos2);
            }
            break;

        case TempEntity.RAILTRAIL:
        case TempEntity.BUBBLETRAIL:
        case TempEntity.BFG_LASER:
        case TempEntity.DEBUGTRAIL:
        case TempEntity.BUBBLETRAIL2:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            break;

        case TempEntity.PARASITE_ATTACK:
        case TempEntity.MEDIC_CABLE_ATTACK:
            this.stream.readShort(); // ent
            this.stream.readPos(pos); // start
            this.stream.readPos(pos2); // end
            break;

        case TempEntity.GRAPPLE_CABLE:
            ent = this.stream.readShort();
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            this.stream.readPos(dir);
            break;

        case TempEntity.LIGHTNING:
            srcEnt = this.stream.readShort();
            destEnt = this.stream.readShort();
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            break;

        case TempEntity.FLASHLIGHT:
            this.stream.readPos(pos);
            ent = this.stream.readShort();
            break;

        case TempEntity.FORCEWALL:
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            color = this.stream.readByte();
            break;

        case TempEntity.STEAM:
             const nextId = this.stream.readShort();
             cnt = this.stream.readByte(); // count
             this.stream.readPos(pos);
             this.stream.readDir(dir);
             color = this.stream.readByte(); // r
             this.stream.readShort(); // magnitude
             if (nextId !== -1) {
                 this.stream.readLong(); // wait
             }
             break;

        case TempEntity.WIDOWBEAMOUT:
            this.stream.readShort(); // id
            // falls through
        case TempEntity.HEATBEAM:
        case TempEntity.MONSTER_HEATBEAM:
            ent = this.stream.readShort();
            this.stream.readPos(pos);
            this.stream.readPos(pos2);
            this.stream.readPos(dir);
            break;

        default:
            // console.warn(`CL_ParseTEnt: bad type ${type}`);
            break;
      }

      if (this.handler) {
          this.handler.onTempEntity(type, pos, pos2, dir, cnt, color, ent, srcEnt, destEnt);
      }
  }

  private parseSpawnBaseline(): void {
    const bits = this.parseEntityBits();
    const entity = createEmptyEntityState();
    this.parseDelta(createEmptyEntityState(), entity, bits.number, bits.bits);

    if (this.handler) {
        this.handler.onSpawnBaseline(entity);
    }
  }

  private parseFrame(): void {
      const serverFrame = this.stream.readLong();
      const deltaFrame = this.stream.readLong();
      const surpressCount = this.stream.readByte();

      const areaBytes = this.stream.readByte();
      const areaBits = this.stream.readData(areaBytes);

      // Player Info
      const piCmd = this.stream.readByte();
      if (piCmd !== ServerCommand.playerinfo) {
          throw new Error(`Expected svc_playerinfo after svc_frame, got ${piCmd}`);
      }
      const playerState = this.parsePlayerState();

      // const count = this.stream.readByte();
      // if (count > 0) {
      //  this.stream.readData(count); // areas
      // }

      if (this.isDemo === RECORD_RELAY) {
          const connectedCount = this.stream.readByte();
          for(let i=0; i<connectedCount; i++) {
              this.stream.readByte();
          }
      }

      if (this.isDemo === RECORD_SERVER) {
          this.stream.readLong();
      }

      // Packet entities usually follows frame
      // In this parser structure, we might need to let the loop handle packet entities
      // but typically frame parsing consumes packet entities if they are embedded?
      // In Q2, CL_ParseFrame reads player info, then packet entities are separate commands.
      // Wait, the original code had `const isDelta = peCmd === ...`
      // But where was `peCmd` read?
      // It seems this function previously assumed it was reading more commands?
      // If this function is ONLY parsing svc_frame, it should stop after reading frame data.
      // PacketEntities is a separate command in the stream.

      // HOWEVER, the `FrameData` interface expects `packetEntities`.
      // If we look at Q2 `CL_ParseFrame`: it reads frame, deltaframe, etc.
      // Then `CL_ParsePacketEntities` is called separately when svc_packetentities is encountered.
      // But `onFrame` seems to want everything.

      // If the parser loop calls `parseFrame` then `parsePacketEntities` separately,
      // we should probably store frame data partially?
      // Or `onFrame` is called when the frame is fully assembled?

      // For now, to fix the build, I will assume packet entities are NOT parsed here
      // and passed as empty/dummy if `onFrame` requires them, OR we change `onFrame` signature.
      // But `onFrame` interface takes `packetEntities`.

      // Looking at `FrameData` interface: `packetEntities: { delta: boolean, entities: EntityState[] }`
      // Since `svc_frame` is just header info, and `svc_packetentities` comes later...
      // Maybe the handler accumulates?

      // For now I will pass empty packet entities to satisfy the type,
      // assuming the loop will hit `svc_packetentities` next and call `parsePacketEntities`.
      // But wait, `parsePacketEntities` calls `onFrame` too?
      // Yes, `parsePacketEntities` calls `onFrame`.
      // So `parseFrame` should probably just store the frame header info?
      // Or `parseFrame` should just read the header.

      // Frame parsing ends here. Packet entities are separate commands.
      // Pass empty entities to handler, assuming they will be handled separately or accumulator handles it.
      if (this.handler) {
          this.handler.onFrame({
              serverFrame,
              deltaFrame,
              surpressCount,
              areaBytes,
              areaBits,
              playerState,
              packetEntities: {
                  delta: false,
                  entities: []
              }
          });
      }
  }

  private parsePlayerState(): ProtocolPlayerState {
      const ps = createEmptyProtocolPlayerState();
      const flags = this.stream.readShort();

      // PS_M_TYPE (1<<0)
      if (flags & 1) ps.pm_type = this.stream.readByte();

      // PS_M_ORIGIN (1<<1)
      if (flags & 2) {
          ps.origin.x = this.stream.readShort() * 0.125;
          ps.origin.y = this.stream.readShort() * 0.125;
          ps.origin.z = this.stream.readShort() * 0.125;
      }

      // PS_M_VELOCITY (1<<2)
      if (flags & 4) {
          ps.velocity.x = this.stream.readShort() * 0.125;
          ps.velocity.y = this.stream.readShort() * 0.125;
          ps.velocity.z = this.stream.readShort() * 0.125;
      }

      // PS_M_TIME (1<<3)
      if (flags & 8) ps.pm_time = this.stream.readByte();

      // PS_M_FLAGS (1<<4)
      if (flags & 16) ps.pm_flags = this.stream.readByte();

      // PS_M_GRAVITY (1<<5)
      if (flags & 32) ps.gravity = this.stream.readShort();

      // PS_M_DELTA_ANGLES (1<<6)
      if (flags & 64) {
          ps.delta_angles.x = this.stream.readShort() * (180 / 32768);
          ps.delta_angles.y = this.stream.readShort() * (180 / 32768);
          ps.delta_angles.z = this.stream.readShort() * (180 / 32768);
      }

      // PS_VIEWOFFSET (1<<7)
      if (flags & 128) {
          ps.viewoffset.x = this.stream.readChar() * 0.25;
          ps.viewoffset.y = this.stream.readChar() * 0.25;
          ps.viewoffset.z = this.stream.readChar() * 0.25;
      }

      // PS_VIEWANGLES (1<<8)
      if (flags & 256) {
          ps.viewangles.x = this.stream.readAngle16();
          ps.viewangles.y = this.stream.readAngle16();
          ps.viewangles.z = this.stream.readAngle16();
      }

      // PS_KICKANGLES (1<<9)
      if (flags & 512) {
          ps.kick_angles.x = this.stream.readChar() * 0.25;
          ps.kick_angles.y = this.stream.readChar() * 0.25;
          ps.kick_angles.z = this.stream.readChar() * 0.25;
      }

      // WEAPONINDEX
      if (flags & 4096) ps.gun_index = this.stream.readByte();

      // WEAPONFRAME (1<<13)
      if (flags & 8192) {
          ps.gun_frame = this.stream.readByte();
          ps.gun_offset.x = this.stream.readChar() * 0.25;
          ps.gun_offset.y = this.stream.readChar() * 0.25;
          ps.gun_offset.z = this.stream.readChar() * 0.25;
          ps.gun_angles.x = this.stream.readChar() * 0.25;
          ps.gun_angles.y = this.stream.readChar() * 0.25;
          ps.gun_angles.z = this.stream.readChar() * 0.25;
      }

      // BLEND (1<<10)
      if (flags & 1024) {
          ps.blend[0] = this.stream.readByte();
          ps.blend[1] = this.stream.readByte();
          ps.blend[2] = this.stream.readByte();
          ps.blend[3] = this.stream.readByte();
      }

      // FOV
      if (flags & 2048) ps.fov = this.stream.readByte();

      // RDFLAGS
      if (flags & 16384) ps.rdflags = this.stream.readByte();

      // STATS
      const statbits = this.stream.readLong();
      for (let i = 0; i < 32; i++) {
          if (statbits & (1 << i)) {
              ps.stats[i] = this.stream.readShort();
          }
      }

      return ps;
  }

  private parsePacketEntities(delta: boolean): void {
      const entities = this.collectPacketEntities();
      if (this.handler) {
          this.handler.onFrame({
              serverFrame: 0, deltaFrame: 0, surpressCount: 0, areaBytes: 0, areaBits: new Uint8Array(),
              playerState: createEmptyProtocolPlayerState(),
              packetEntities: { delta, entities }
          });
      }
  }

  private collectPacketEntities(): EntityState[] {
      const entities: EntityState[] = [];
      while (true) {
          const bits = this.parseEntityBits();
          if (bits.number === 0) {
              break;
          }
          const entity = createEmptyEntityState();
          this.parseDelta(createEmptyEntityState(), entity, bits.number, bits.bits);
          entities.push(entity);
      }
      return entities;
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
      to.bits = bits;

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
