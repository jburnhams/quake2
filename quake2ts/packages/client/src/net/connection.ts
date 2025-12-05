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

  constructor(options: MultiplayerConnectionOptions) {
    this.driver = new BrowserWebSocketNetDriver();
    this.options = options;
    this.netchan = new NetChan();

    this.driver.onMessage((data) => this.handleMessage(data));
    this.driver.onClose(() => this.handleDisconnect());
    this.driver.onError((err) => console.error('Network Error:', err));
  }

  public setPrediction(prediction: ClientPrediction) {
      this.prediction = prediction;
  }

  public setDemoRecorder(recorder: DemoRecorder) {
      this.demoRecorder = recorder;
  }

  public async connect(url: string): Promise<void> {
    if (this.state !== ConnectionState.Disconnected) {
      this.disconnect();
    }

    console.log(`Connecting to ${url}...`);
    this.state = ConnectionState.Connecting;

    // Reset netchan state for new connection
    // Note: qport is preserved or randomized in constructor.
    // We should probably re-randomize or keep it if we want to be same client.
    // For now, simple reset.
    this.netchan.reset();

    try {
      await this.driver.connect(url);
      console.log('WebSocket connected.');
      this.state = ConnectionState.Challenge;
      this.sendChallenge();
    } catch (e) {
      console.error('Connection failed:', e);
      this.state = ConnectionState.Disconnected;
      throw e;
    }
  }

  public disconnect(): void {
    if (this.state === ConnectionState.Disconnected) return;

    this.driver.disconnect();
    this.state = ConnectionState.Disconnected;
    this.configStrings.clear();
    this.baselines.clear();
    this.commandHistory = [];
    this.latestServerFrame = 0;
  }

  public sendCommand(cmd: UserCommand): void {
      if (this.state !== ConnectionState.Active) return;

      // Assign the last acknowledged server frame to this command
      // This is crucial for prediction reconciliation
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
    // NetChan handles sequence numbers, acks, reliable message assembly
    const processedData = this.netchan.process(new Uint8Array(buffer));

    if (!processedData) {
        // Packet discarded (duplicate, out of order, or invalid qport)
        return;
    }

    // Process the payload
    if (processedData.byteLength > 0) {
        // If recording, write the raw message (decrypted/assembled payload)
        // Note: Demo files usually store the NetChan payload (sequence, ack, etc removed?)
        // Or do they store the raw packet?
        // Quake 2 demos store the message block *after* NetChan processing (the raw commands).
        // The format is [Length][MessageData].
        // MessageData is exactly `processedData`.
        if (this.demoRecorder && this.demoRecorder.getIsRecording()) {
            this.demoRecorder.recordMessage(processedData);
        }

        const stream = new BinaryStream(processedData.buffer as ArrayBuffer);
        // Create parser for the message content
        this.parser = new NetworkMessageParser(stream, this);
        this.parser.parseMessage();
    }
  }

  private handleDisconnect(): void {
    console.log('Disconnected from server.');
    this.state = ConnectionState.Disconnected;
  }

  private sendChallenge(): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);
    builder.writeString('getchallenge');

    // Send directly via NetChan
    const packet = this.netchan.transmit(builder.getData());
    this.driver.send(packet);
  }

  private sendConnect(challenge: number): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);

    const userinfo = `\\name\\${this.options.username}\\model\\${this.options.model}\\skin\\${this.options.skin}\\hand\\${this.options.hand ?? 0}\\fov\\${this.options.fov ?? 90}`;

    // Use the client's supported protocol version
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

      this.state = ConnectionState.Connected;

      // Send "new" command to acknowledge we are loading
      const builder = new NetworkMessageBuilder();
      builder.writeByte(ClientCommand.stringcmd);
      builder.writeString('new');

      const packet = this.netchan.transmit(builder.getData());
      this.driver.send(packet);

      this.state = ConnectionState.Loading;
  }

  onConfigString(index: number, str: string): void {
      this.configStrings.set(index, str);
  }

  onSpawnBaseline(entity: EntityState): void {
      this.baselines.set(entity.number, entity);
  }

  onStuffText(msg: string): void {
      console.log(`Server StuffText: ${msg}`);
      // Handle "precache" command which usually signals end of loading
      if (msg.startsWith('precache')) {
          this.finishLoading();
      }

      // Handle challenge response
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

      this.state = ConnectionState.Active;
  }

  onFrame(frame: FrameData): void {
    // Keep track of the latest server frame received for ack/prediction
    if (frame.serverFrame > this.latestServerFrame) {
      this.latestServerFrame = frame.serverFrame;
    }

    // Process player state for prediction reconciliation
    if (this.prediction && frame.playerState) {
        // Convert to GameFrameResult<PredictionState>
        // Note: FrameData.playerState is PlayerState (from @quake2ts/engine or shared)
        // We need to cast or convert it.
        // Assuming frame.playerState is compatible with PredictionState structure
        // (PredictionState extends PlayerState)

        // Construct a safe default state if fields are missing
        const ps = frame.playerState;
        const predState: PredictionState = {
            ...defaultPredictionState(),
            // Manual mapping due to type mismatch (MutableVec3 vs Vec3, and property names)
            origin: { x: ps.origin.x, y: ps.origin.y, z: ps.origin.z },
            velocity: { x: ps.velocity.x, y: ps.velocity.y, z: ps.velocity.z },
            viewAngles: { x: ps.viewangles.x, y: ps.viewangles.y, z: ps.viewangles.z },
            deltaAngles: { x: ps.delta_angles.x, y: ps.delta_angles.y, z: ps.delta_angles.z },
            pmFlags: ps.pm_flags,
            pmType: ps.pm_type,
            gravity: ps.gravity,
            // Copy other matching fields
            health: ps.stats[0], // Assuming stat 0 is health? Or generic copy
            // ...
        };

        const gameFrame: GameFrameResult<PredictionState> = {
            frame: frame.serverFrame,
            timeMs: 0, // Should be server time, but frame doesn't always have it explicitly?
            state: predState
        };

        this.prediction.setAuthoritative(gameFrame);
    }
  }

  // Stubs for other handlers
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
