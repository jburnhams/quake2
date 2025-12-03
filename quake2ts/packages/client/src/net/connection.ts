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
  PROTOCOL_VERSION_RERELEASE
} from '@quake2ts/engine';
import { BrowserWebSocketNetDriver } from './browserWsDriver.js';

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

  constructor(options: MultiplayerConnectionOptions) {
    this.driver = new BrowserWebSocketNetDriver();
    this.options = options;
    this.netchan = new NetChan();

    this.driver.onMessage((data) => this.handleMessage(data));
    this.driver.onClose(() => this.handleDisconnect());
    this.driver.onError((err) => console.error('Network Error:', err));
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
    if (buffer instanceof SharedArrayBuffer) {
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
