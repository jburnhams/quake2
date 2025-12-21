import {
  EntityState,
  FrameData,
  createEmptyEntityState,
  ProtocolPlayerState,
  createEmptyProtocolPlayerState,
  NetworkMessageHandler,
  NetworkMessageParser,
  FogData,
  DamageIndicator
} from '@quake2ts/engine';
import {
  ClientCommand,
  NetChan,
  UserCommand,
  BinaryWriter,
  BinaryStream,
  writeUserCommand,
  CMD_BACKUP,
  Vec3
} from '@quake2ts/shared';
import { ClientPrediction, PredictionState, defaultPredictionState } from '@quake2ts/cgame';
import { ClientEffectSystem } from '../effects-system.js';

export enum ConnectionState {
  Disconnected,
  Connecting,
  Challenge,
  Connected,
  Loading,
  Active
}

export interface ClientConnectionOptions {
    prediction?: ClientPrediction;
    effectSystem?: ClientEffectSystem;
}

/**
 * Manages the client-side game state and protocol handling.
 * Decoupled from the network transport (WebSocket/NetChan).
 */
export class ClientConnection implements NetworkMessageHandler {
  public state: ConnectionState = ConnectionState.Disconnected;

  // Game State
  public serverProtocol = 0;
  public serverCount = 0;
  public gameDir = '';
  public playerNum = 0;
  public levelName = '';
  public configStrings = new Map<number, string>();
  public baselines = new Map<number, EntityState>();
  public entities = new Map<number, EntityState>();

  public latestServerFrame = 0;

  // Dependencies
  private prediction?: ClientPrediction;
  private effectSystem?: ClientEffectSystem;

  // Events
  public onStateChange?: (state: ConnectionState) => void;
  public onDisconnected?: () => void;
  public onPacket?: (data: Uint8Array) => void; // Outgoing data (e.g. stringcmd)

  // Prediction helpers
  private frameCRCs = new Map<number, number>();

  constructor(options: ClientConnectionOptions = {}) {
      this.prediction = options.prediction;
      this.effectSystem = options.effectSystem;
  }

  public reset(): void {
    this.configStrings.clear();
    this.baselines.clear();
    this.entities.clear();
    this.latestServerFrame = 0;
    this.frameCRCs.clear();
    this.serverProtocol = 0;
    this.setState(ConnectionState.Disconnected);
  }

  public setState(newState: ConnectionState): void {
      if (this.state !== newState) {
          this.state = newState;
          if (this.onStateChange) {
              this.onStateChange(newState);
          }
      }
  }

  /**
   * Processes a network message (payload) from the server.
   * This expects the data to be already processed by NetChan (i.e., raw game protocol commands).
   */
  public handleMessage(data: Uint8Array, crc: number = 0): void {
      // Store CRC for the current packet processing context if needed
      // But typically handleMessage is synchronous.

      const stream = new BinaryStream(data.buffer as ArrayBuffer);
      // We pass 'this' as the handler
      const parser = new NetworkMessageParser(stream, this);

      // IMPORTANT: Set the protocol version on the new parser
      if (this.serverProtocol > 0) {
          parser.setProtocolVersion(this.serverProtocol);
      }

      parser.parseMessage();
  }

  public recordFrameCRC(frame: number, crc: number): void {
      this.frameCRCs.set(frame, crc);
  }

  public getFrameCRC(frame: number): number {
      return this.frameCRCs.get(frame) || 0;
  }

  // ==================================================================================
  // NetworkMessageHandler Implementation
  // ==================================================================================

  onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string): void {
      this.serverProtocol = protocol;
      this.serverCount = serverCount;
      this.gameDir = gameDir;
      this.playerNum = playerNum;
      this.levelName = levelName;

      this.setState(ConnectionState.Connected);
  }

  onConfigString(index: number, str: string): void {
      this.configStrings.set(index, str);
  }

  onSpawnBaseline(entity: EntityState): void {
      this.baselines.set(entity.number, entity);
  }

  onStuffText(msg: string): void {
      // StuffText is often handled by the specific connection wrapper to send responses,
      // but we can expose events or hooks.
      // For basic state, we might parse challenge here if we want to be pure.
  }

  onFrame(frame: FrameData): void {
    if (frame.serverFrame > this.latestServerFrame) {
      this.latestServerFrame = frame.serverFrame;
    }

    // Update Entities Map
    const packetEntities = frame.packetEntities;

    if (!packetEntities.delta) {
        this.entities.clear();
    }

    for (const ent of packetEntities.entities) {
        this.entities.set(ent.number, ent);
    }

    if (this.prediction && frame.playerState) {
        // Update prediction system
        const ps = frame.playerState;
        const predState: PredictionState = {
            ...defaultPredictionState(),
            origin: { x: ps.origin.x, y: ps.origin.y, z: ps.origin.z },
            velocity: { x: ps.velocity.x, y: ps.velocity.y, z: ps.velocity.z },
            viewAngles: { x: ps.viewangles.x, y: ps.viewangles.y, z: ps.viewangles.z },
            deltaAngles: { x: ps.delta_angles.x, y: ps.delta_angles.y, z: ps.delta_angles.z },
            pmFlags: ps.pm_flags,
            pmType: ps.pm_type,
            gravity: ps.gravity,
            health: ps.stats[0],
        };

        this.prediction.setAuthoritative({
            frame: frame.serverFrame,
            timeMs: 0,
            state: predState
        });
    }
  }

  onDisconnect(): void {
      this.setState(ConnectionState.Disconnected);
      if (this.onDisconnected) this.onDisconnected();
  }

  // Stubs for other handlers
  onCenterPrint(msg: string): void {}
  onPrint(level: number, msg: string): void {}

  onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {}

  onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
      if (this.effectSystem) {
          const time = Date.now() / 1000.0; // TODO: Pass time in handleMessage?
          this.effectSystem.onTempEntity(type, pos, time);
      }
  }

  onLayout(layout: string): void {}
  onInventory(inventory: number[]): void {}

  onMuzzleFlash(ent: number, weapon: number): void {
      if (this.effectSystem) {
          const time = Date.now() / 1000.0;
          this.effectSystem.onMuzzleFlash(ent, weapon, time);
      }
  }

  onMuzzleFlash2(ent: number, weapon: number): void {}

  onMuzzleFlash3(ent: number, weapon: number): void {
      if (this.effectSystem) {
          const time = Date.now() / 1000.0;
          this.effectSystem.onMuzzleFlash(ent, weapon, time);
      }
  }

  onReconnect(): void {}
  onDownload(size: number, percent: number, data?: Uint8Array): void {}

  onSplitClient(clientNum: number): void {}
  onConfigBlast(index: number, data: Uint8Array): void {}
  onSpawnBaselineBlast(entity: EntityState): void {}
  onLevelRestart(): void {}
  onDamage(indicators: DamageIndicator[]): void {}
  onLocPrint(flags: number, base: string, args: string[]): void {}
  onFog(data: FogData): void {}
  onWaitingForPlayers(count: number): void {}
  onBotChat(msg: string): void {}
  onPoi(flags: number, pos: Vec3): void {}
  onHelpPath(pos: Vec3): void {}
  onAchievement(id: string): void {}
}
