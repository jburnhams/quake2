import {
  NetDriver,
  ClientCommand,
  ServerCommand,
  UserCommand,
  BinaryStream,
  NetworkMessageBuilder,
  writeUserCommand,
  BinaryWriter,
  CMD_BACKUP,
  NetChan
} from '@quake2ts/shared';
import {
  NetworkMessageParser,
  NetworkMessageHandler,
  EntityState,
  FrameData,
  createEmptyEntityState,
  PROTOCOL_VERSION_RERELEASE,
  DemoRecorder
} from '@quake2ts/engine';
import { BrowserWebSocketNetDriver } from './browserWsDriver.js';
import { ClientPrediction, PredictionState, defaultPredictionState } from '@quake2ts/cgame';
import { GameFrameResult } from '@quake2ts/engine';

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

  private challenge = 0;
  private connectPacketCount = 0;
  private connectPacketTime = 0;

  public latestServerFrame = 0;
  private commandHistory: UserCommand[] = [];

  // Prediction
  public prediction: ClientPrediction | null = null;

  // Demo Recording
  private demoRecorder: DemoRecorder | null = null;

  // Events
  public onConnectionStateChange?: (state: ConnectionState) => void;
  public onConnectionError?: (error: Error) => void;

  // Ping calculation
  private lastPingTime = 0;
  private currentPing = 0;

  constructor(options: MultiplayerConnectionOptions) {
    this.driver = new BrowserWebSocketNetDriver();
    this.options = options;
    this.netchan = new NetChan();

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
    this.baselines.clear();
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

  public sendCommand(cmd: UserCommand): void {
      if (this.state !== ConnectionState.Active) return;

      // Assign the last acknowledged server frame to this command
      const commandWithFrame: UserCommand = {
          ...cmd,
          serverFrame: cmd.serverFrame ?? this.latestServerFrame
      };

      // Buffer command for retransmission/prediction
      this.commandHistory.push(commandWithFrame);
      if (this.commandHistory.length > CMD_BACKUP) {
          this.commandHistory.shift();
      }

      // Enqueue to local prediction system if available
      if (this.prediction) {
          this.prediction.enqueueCommand(commandWithFrame);
      }

      const writer = new BinaryWriter();

      writer.writeByte(ClientCommand.move);
      writer.writeByte(0); // checksum (crc8 of last server frame) - TODO
      writer.writeLong(this.latestServerFrame); // lastframe (ack)

      writeUserCommand(writer, commandWithFrame);

      // Use NetChan to wrap the command
      const packet = this.netchan.transmit(writer.getData());
      this.driver.send(packet);
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

        const stream = new BinaryStream(processedData.buffer as ArrayBuffer);
        this.parser = new NetworkMessageParser(stream, this);
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
      this.serverProtocol = protocol;
      this.serverCount = serverCount;
      this.gameDir = gameDir;
      this.playerNum = playerNum;
      this.levelName = levelName;

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
  }

  onSpawnBaseline(entity: EntityState): void {
      this.baselines.set(entity.number, entity);
  }

  onStuffText(msg: string): void {
      console.log(`Server StuffText: ${msg}`);
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

        this.prediction.setAuthoritative(gameFrame);
    }
  }

  onCenterPrint(msg: string): void {}
  onPrint(level: number, msg: string): void {}
  onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: any): void {}
  onTempEntity(type: number, pos: any, pos2?: any, dir?: any, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {}
  onLayout(layout: string): void {}
  onInventory(inventory: number[]): void {}
  onMuzzleFlash(ent: number, weapon: number): void {}
  onMuzzleFlash2(ent: number, weapon: number): void {}
  onDisconnect(): void { this.disconnect(); }
  onReconnect(): void {}
  onDownload(size: number, percent: number, data?: Uint8Array): void {}
}
