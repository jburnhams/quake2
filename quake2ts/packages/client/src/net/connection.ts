import {
  NetDriver,
  ClientCommand,
  ServerCommand,
  UserCommand,
  BinaryStream,
  NetworkMessageBuilder,
  writeUserCommand,
  BinaryWriter,
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

  constructor(options: MultiplayerConnectionOptions) {
    this.driver = new BrowserWebSocketNetDriver();
    this.options = options;

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
  }

  public sendCommand(cmd: UserCommand): void {
      if (this.state !== ConnectionState.Active) return;

      const writer = new BinaryWriter();

      // Sequence number handling would go here, but for now we write header (seq/ack) if needed
      // Assuming simple framing for now where we just send the command.
      // NOTE: Q2 uses clc_move which includes checksum and loss.
      // Standard Q2 Client packet:
      // [Sequence] [Ack Sequence] [Command] [Args...]

      // Let's implement full packet structure for WebSocket transport (Sequence + Ack + Command)
      // This mirrors what we expect in handleMessage (seq, ack).
      // We are not tracking sequence numbers properly yet, using 0 placeholder.

      writer.writeLong(0); // Sequence
      writer.writeLong(0); // Ack Sequence

      writer.writeByte(ClientCommand.move);
      writer.writeByte(0); // checksum (crc8 of last server frame) - TODO
      writer.writeLong(0); // lastframe (ack) - TODO: Track last received server frame

      writeUserCommand(writer, cmd);

      this.driver.send(writer.getData());
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

    const stream = new BinaryStream(buffer as ArrayBuffer);

    // In Q2, the first long is sequence number, usually handled by NetChan.
    // Since we use WebSockets, we might treat the whole payload as the message stream.
    // However, existing server implementation likely sends raw packet data.

    // Check if we need to parse NetChan header or if WebSocket is the NetChan.
    // Assuming WebSocket frame = NetChan packet.

    // The sequence number handling is missing in shared/NetChan for now,
    // but the Parser expects a stream of commands.

    // If the server sends a sequence number, we should skip it or handle it.
    // Let's assume standard Q2 NetChan header: sequence (4 bytes), sequence_ack (4 bytes).

    const sequence = stream.readLong();
    const sequenceAck = stream.readLong();

    // Create parser for the rest of the message
    this.parser = new NetworkMessageParser(stream, this);
    this.parser.parseMessage();
  }

  private handleDisconnect(): void {
    console.log('Disconnected from server.');
    this.state = ConnectionState.Disconnected;
  }

  private sendChallenge(): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);
    builder.writeString('getchallenge');
    this.driver.send(builder.getData());
  }

  private sendConnect(challenge: number): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);

    const userinfo = `\\name\\${this.options.username}\\model\\${this.options.model}\\skin\\${this.options.skin}\\hand\\${this.options.hand ?? 0}\\fov\\${this.options.fov ?? 90}`;

    // Use the client's supported protocol version
    builder.writeString(`connect ${PROTOCOL_VERSION_RERELEASE} ${challenge} ${userinfo}`);
    this.driver.send(builder.getData());
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
      this.driver.send(builder.getData());

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
      this.driver.send(builder.getData());

      this.state = ConnectionState.Active;
  }

  // Stubs for other handlers
  onFrame(frame: FrameData): void {}
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
