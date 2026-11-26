import {
  NetDriver,
  ClientCommand,
  ServerCommand,
  UserCommand,
  BinaryStream,
  NetworkMessageBuilder,
  writeMove,
  BinaryWriter,
  CMD_BACKUP,
  NetChan,
  Vec3
} from '@quake2ts/shared';
import {
  NetworkMessageParser,
  NetworkMessageHandler,
  EntityState,
  FrameData,
  ClientFrames,
  PROTOCOL_VERSION_RERELEASE,
  DemoRecorder,
  FogData,
  DamageIndicator
} from '@quake2ts/engine';
import { BrowserWebSocketNetDriver } from './browserWsDriver.js';
import { ClientPrediction, PredictionState, defaultPredictionState } from '@quake2ts/cgame';
import { GameFrameResult } from '@quake2ts/engine';
import { ClientEffectSystem } from '../effects-system.js';

export enum ConnectionState {
  Disconnected,
  Connecting,
  Challenge,
  Connected,
  Loading,
  Active
}

export interface MultiplayerConnectionOptions {
    username: string;
    model: string;
    skin: string;
    hand?: number;
    fov?: number;
    netchan?: NetChan;
}

/** Where a connection's configstrings go: each one as it arrives, and a clear for a new server. */
export interface ConfigStringListener {
  set(index: number, value: string): void;
  clear(): void;
}

export class MultiplayerConnection implements NetworkMessageHandler {
  private driver: NetDriver;
  private state: ConnectionState = ConnectionState.Disconnected;
  private parser: NetworkMessageParser | null = null;
  private options: MultiplayerConnectionOptions;
  private netchan: NetChan;

  // Game State
  public serverProtocol = 0;
  public serverCount = 0;
  public gameDir = '';
  public playerNum = 0;
  public levelName = '';
  public configStrings = new Map<number, string>();
  public baselines = new Map<number, EntityState>();
  /** The entities of the newest valid frame, updated in place. */
  public entities = new Map<number, EntityState>();
  /** The last UPDATE_BACKUP frames, for the next frame's delta (cl.frames). */
  private frames = new ClientFrames();

  private challenge = 0;
  private connectPacketCount = 0;
  private connectPacketTime = 0;

  public latestServerFrame = 0;
  private commandHistory: UserCommand[] = [];

  // Prediction
  public prediction: ClientPrediction | null = null;

  // Demo Recording
  private demoRecorder: DemoRecorder | null = null;
  private configStringListener: ConfigStringListener | null = null;

  // Events
  public onConnectionStateChange?: (state: ConnectionState) => void;
  public onConnectionError?: (error: Error) => void;

  // Ping calculation
  private lastPingTime = 0;
  private currentPing = 0;

  private effectSystem?: ClientEffectSystem;

  constructor(options: MultiplayerConnectionOptions) {
    this.driver = new BrowserWebSocketNetDriver();
    this.options = options;
    this.netchan = options.netchan ?? new NetChan();

    this.driver.onMessage((data) => this.handleMessage(data));
    this.driver.onClose(() => this.handleDisconnect());
    this.driver.onError((err) => {
        console.error('Network Error:', err);
        if (this.onConnectionError) {
            this.onConnectionError(err);
        }
    });
  }

  public setPrediction(prediction: ClientPrediction) {
      this.prediction = prediction;
  }

  public setDemoRecorder(recorder: DemoRecorder) {
      this.demoRecorder = recorder;
  }

  /**
   * Told of every configstring the server sends, after it is stored: the client parses it as
   * CL_ParseConfigString does (models, sounds, images, light styles, skins, the CD track). Told
   * to clear them on new server data and on disconnect, as CL_ClearState does, since a server
   * sends only the configstrings it has set.
   */
  public setConfigStringListener(listener: ConfigStringListener | null) {
    this.configStringListener = listener;
  }

  public setEffectSystem(system: ClientEffectSystem) {
      this.effectSystem = system;
  }

  public async connectToServer(address: string, port: number): Promise<void> {
    const url = `ws://${address}:${port}`;
    return this.connect(url);
  }

  public async connect(url: string): Promise<void> {
    if (this.state !== ConnectionState.Disconnected) {
      this.disconnect();
    }

    console.log(`Connecting to ${url}...`);
    this.setState(ConnectionState.Connecting);

    // Reset netchan state for new connection
    this.netchan.reset();

    try {
      await this.driver.connect(url);
      console.log('WebSocket connected.');
      this.setState(ConnectionState.Challenge);
      this.sendChallenge();
      this.lastPingTime = Date.now();
    } catch (e) {
      console.error('Connection failed:', e);
      this.setState(ConnectionState.Disconnected);
      if (this.onConnectionError) {
          this.onConnectionError(e instanceof Error ? e : new Error(String(e)));
      }
      throw e;
    }
  }

  public disconnect(): void {
    if (this.state === ConnectionState.Disconnected) return;

    this.driver.disconnect();
    this.setState(ConnectionState.Disconnected);
    this.cleanup();
  }

  private cleanup(): void {
    this.configStrings.clear();
    this.configStringListener?.clear();
    this.baselines.clear();
    this.entities.clear();
    this.frames.reset();
    this.commandHistory = [];
    this.latestServerFrame = 0;
    this.parser = null;
    // Note: Do not clear options or listeners as they might be reused
  }

  private setState(newState: ConnectionState): void {
      if (this.state !== newState) {
          this.state = newState;
          if (this.onConnectionStateChange) {
              this.onConnectionStateChange(newState);
          }
      }
  }

  public getPing(): number {
      return this.currentPing;
  }

  /**
   * Sends one command (CL_SendCmd) and returns it as sent, numbered with the netchan sequence of
   * the packet that carries it. That number is what a snapshot acknowledges (the netchan's
   * incoming acknowledged sequence), so the caller predicts with the returned command.
   */
  public sendCommand(cmd: UserCommand): UserCommand {
      if (this.state !== ConnectionState.Active) return cmd;

      const commandWithFrame: UserCommand = {
          ...cmd,
          sequence: this.netchan.outgoingSequence + 1,
          serverFrame: cmd.serverFrame ?? this.latestServerFrame
      };

      // Buffer command for retransmission
      this.commandHistory.push(commandWithFrame);
      if (this.commandHistory.length > CMD_BACKUP) {
          this.commandHistory.shift();
      }

      const writer = new BinaryWriter();

      writeMove(writer, this.frames.acknowledged, this.commandHistory, commandWithFrame.sequence);

      // Use NetChan to wrap the command
      const packet = this.netchan.transmit(writer.getData());
      this.driver.send(packet);
      return commandWithFrame;
  }

  private handleMessage(data: Uint8Array): void {
    // Check if buffer is SharedArrayBuffer and copy if necessary
    let buffer = data.buffer;
    if (typeof SharedArrayBuffer !== 'undefined' && buffer instanceof SharedArrayBuffer) {
        // Copy to ArrayBuffer
        const newBuffer = new ArrayBuffer(data.byteLength);
        new Uint8Array(newBuffer).set(data);
        buffer = newBuffer;
    }

    // Process via NetChan
    const processedData = this.netchan.process(new Uint8Array(buffer));

    if (!processedData) {
        return;
    }

    // Process the payload
    if (processedData.byteLength > 0) {
        if (this.demoRecorder && this.demoRecorder.getIsRecording()) {
            this.demoRecorder.recordMessage(processedData);
        }

        const stream = new BinaryStream(processedData);
        this.parser = new NetworkMessageParser(stream, this);
        if (this.serverProtocol > 0) {
            this.parser.setProtocolVersion(this.serverProtocol);
        }
        this.parser.parseMessage();

        // Update ping on receiving frame or valid response
        const now = Date.now();
        if (this.lastPingTime > 0) {
            // Very rough ping estimation (RTT)
            // Real ping should be based on ack of commands but this is a start
             this.currentPing = now - this.lastPingTime;
        }
        this.lastPingTime = now;
    }
  }

  private handleDisconnect(): void {
    console.log('Disconnected from server.');
    this.setState(ConnectionState.Disconnected);
    this.cleanup();
  }

  private sendChallenge(): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);
    builder.writeString('getchallenge');

    const packet = this.netchan.transmit(builder.getData());
    this.driver.send(packet);
  }

  private sendConnect(challenge: number): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);

    const userinfo = `\\name\\${this.options.username}\\model\\${this.options.model}\\skin\\${this.options.skin}\\hand\\${this.options.hand ?? 0}\\fov\\${this.options.fov ?? 90}`;

    builder.writeString(`connect ${PROTOCOL_VERSION_RERELEASE} ${challenge} ${userinfo}`);

    const packet = this.netchan.transmit(builder.getData());
    this.driver.send(packet);
  }

  public isConnected(): boolean {
      return this.state === ConnectionState.Active;
  }

  // ==================================================================================
  // NetworkMessageHandler Implementation
  // ==================================================================================

  onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string): void {
      console.log(`Server Data: Protocol ${protocol}, Level ${levelName}`);
      // CL_ClearState: a new server (or level) starts from no configstrings.
      this.configStrings.clear();
      this.configStringListener?.clear();
      this.serverProtocol = protocol;
      this.serverCount = serverCount;
      this.gameDir = gameDir;
      this.playerNum = playerNum;
      this.levelName = levelName;
      // CL_ParseServerData begins with CL_ClearState: a new server numbers its frames afresh.
      this.prediction?.reset();

      this.setState(ConnectionState.Connected);

      // Send "new" command to acknowledge we are loading
      const builder = new NetworkMessageBuilder();
      builder.writeByte(ClientCommand.stringcmd);
      builder.writeString('new');

      const packet = this.netchan.transmit(builder.getData());
      this.driver.send(packet);

      this.setState(ConnectionState.Loading);
  }

  onConfigString(index: number, str: string): void {
      this.configStrings.set(index, str);
      this.configStringListener?.set(index, str);
  }

  onSpawnBaseline(entity: EntityState): void {
      this.baselines.set(entity.number, entity);
  }

  onStuffText(msg: string): void {
      if (msg.startsWith('precache')) {
          this.finishLoading();
      }

      if (msg.startsWith('challenge ')) {
          const parts = msg.split(' ');
          if (parts.length > 1) {
              this.challenge = parseInt(parts[1], 10);
              this.sendConnect(this.challenge);
          }
      }
  }

  private finishLoading(): void {
      console.log('Finished loading, sending begin...');
      const builder = new NetworkMessageBuilder();
      builder.writeByte(ClientCommand.stringcmd);
      builder.writeString('begin');

      const packet = this.netchan.transmit(builder.getData());
      this.driver.send(packet);

      this.setState(ConnectionState.Active);
  }

  onFrame(frame: FrameData): void {
    if (frame.serverFrame > this.latestServerFrame) {
      this.latestServerFrame = frame.serverFrame;
    }

    // CL_ParseFrame: the frame is its delta frame plus this packet. One whose delta frame is
    // gone is not drawn and not acknowledged, so the server's next frame is whole.
    const parsed = this.frames.parse(frame, this.baselines);
    if (!parsed.valid) return;

    this.entities.clear();
    for (const [number, entity] of parsed.entities) this.entities.set(number, entity);

    if (this.prediction && frame.playerState) {
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

        const gameFrame: GameFrameResult<PredictionState> = {
            frame: frame.serverFrame,
            timeMs: 0,
            state: predState
        };

        // CL_PredictMovement replays from the last command the server had when it sent this
        // snapshot: the netchan's incoming acknowledged sequence, which this packet just set.
        this.prediction.setAuthoritative(gameFrame, this.netchan.incomingAcknowledged);
    }
  }

  onCenterPrint(msg: string): void {}
  onPrint(level: number, msg: string): void {}
  onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {}

  onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
      if (this.effectSystem) {
          const time = Date.now() / 1000.0; // Use local time for now
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

  onMuzzleFlash2(ent: number, weapon: number): void {
      // Helper for MZ2 types?
  }

  onMuzzleFlash3(ent: number, weapon: number): void {
      if (this.effectSystem) {
          const time = Date.now() / 1000.0;
          this.effectSystem.onMuzzleFlash(ent, weapon, time);
      }
  }

  onDisconnect(): void { this.disconnect(); }
  onReconnect(): void {}
  onDownload(size: number, percent: number, data?: Uint8Array): void {}

  // New handlers stubs
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