import {
  NetChan,
  ClientCommand,
  NetworkMessageBuilder,
  BinaryStream,
  crc8,
  BinaryWriter,
  writeUserCommand,
  CMD_BACKUP,
  UserCommand,
  Vec3
} from '@quake2ts/shared';
import {
  NetworkMessageParser,
  NetworkMessageHandler,
  EntityState,
  FrameData,
  createEmptyEntityState,
  PROTOCOL_VERSION_RERELEASE,
  FogData,
  DamageIndicator
} from '../demo/parser.js';

export enum ConnectionState {
  Disconnected,
  Connecting,
  Challenge,
  Connected,
  Loading,
  Active
}

export type ConnectionEvents = {
  'state': (state: ConnectionState) => void;
  'frame': (frame: FrameData) => void;
  'disconnect': (reason?: string) => void;
  'print': (msg: string, level: number) => void;
  'centerprint': (msg: string) => void;
  'send': (data: Uint8Array) => void; // Outbound data to be sent via transport
  'serverdata': (data: { protocol: number; serverCount: number; gameDir: string; levelName: string }) => void;
  'stufftext': (text: string) => void;
  'error': (err: Error) => void;
  'download': (size: number, percent: number, data?: Uint8Array) => void;
  'temp_entity': (data: { type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number }) => void;
  'muzzleflash': (ent: number, weapon: number) => void;
  'sound': (data: { flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3 }) => void;
  'inventory': (inventory: number[]) => void;
};

export interface ClientConnectionOptions {
  username: string;
  model: string;
  skin: string;
  hand?: number;
  fov?: number;
  netchan?: NetChan;
}

/**
 * Manages the client-side network protocol state machine.
 * Decoupled from the transport layer (WebSocket/UDP).
 */
export class ClientConnection implements NetworkMessageHandler {
  private state: ConnectionState = ConnectionState.Disconnected;
  private netchan: NetChan;
  private parser: NetworkMessageParser | null = null;
  private options: ClientConnectionOptions;

  // Event listeners
  private listeners: Partial<Record<keyof ConnectionEvents, Array<any>>> = {};

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
  private frameCRCs = new Map<number, number>();
  private currentPacketCRC = 0;
  private commandHistory: UserCommand[] = [];

  constructor(options: ClientConnectionOptions) {
    this.options = options;
    this.netchan = options.netchan ?? new NetChan();
  }

  public on<K extends keyof ConnectionEvents>(event: K, callback: ConnectionEvents[K]): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(callback);
  }

  public off<K extends keyof ConnectionEvents>(event: K, callback: ConnectionEvents[K]): void {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event]!.filter(cb => cb !== callback);
  }

  private emit<K extends keyof ConnectionEvents>(event: K, ...args: Parameters<ConnectionEvents[K]>): void {
    if (this.listeners[event]) {
      this.listeners[event]!.forEach(cb => cb(...args));
    }
  }

  /**
   * Resets the connection state and netchan.
   * Call this before starting a new connection flow.
   */
  public connect(): void {
    this.netchan.reset();
    this.cleanup();
    this.setState(ConnectionState.Connecting);
  }

  /**
   * Initiate the connection protocol by sending a challenge request.
   * Should be called after transport is established.
   */
  public startProtocol(): void {
    if (this.state !== ConnectionState.Connecting) {
      this.connect();
    }
    this.setState(ConnectionState.Challenge);
    this.sendChallenge();
  }

  public disconnect(): void {
    if (this.state === ConnectionState.Disconnected) return;
    this.setState(ConnectionState.Disconnected);
    this.emit('disconnect');
    this.cleanup();
  }

  private cleanup(): void {
    this.configStrings.clear();
    this.baselines.clear();
    this.entities.clear();
    this.commandHistory = [];
    this.latestServerFrame = 0;
    this.parser = null;
    this.frameCRCs.clear();
  }

  public getState(): ConnectionState {
    return this.state;
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.emit('state', newState);
    }
  }

  /**
   * Process an incoming raw packet from the server.
   */
  public handleMessage(data: ArrayBuffer): void {
    // NetChan processing (sequence numbers, reliability)
    const processedData = this.netchan.process(new Uint8Array(data));

    if (!processedData || processedData.byteLength === 0) {
      return;
    }

    // Calculate CRC for potential frame update (used in command acknowledgement)
    this.currentPacketCRC = crc8(processedData);

    const stream = new BinaryStream(processedData.buffer as ArrayBuffer);
    // Reuse parser or create new? Parser maintains some state?
    // NetworkMessageParser seems stateless except for protocolVersion.
    this.parser = new NetworkMessageParser(stream, this);
    if (this.serverProtocol) {
      this.parser.setProtocolVersion(this.serverProtocol);
    }
    this.parser.parseMessage();
  }

  /**
   * Send a user command (movement) to the server.
   */
  public sendUserCommand(cmd: UserCommand): void {
    if (this.state !== ConnectionState.Active) return;

    const commandWithFrame: UserCommand = {
      ...cmd,
      serverFrame: cmd.serverFrame ?? this.latestServerFrame
    };

    // Buffer command
    this.commandHistory.push(commandWithFrame);
    if (this.commandHistory.length > CMD_BACKUP) {
      this.commandHistory.shift();
    }

    const writer = new BinaryWriter();
    writer.writeByte(ClientCommand.move);
    const checksum = this.frameCRCs.get(this.latestServerFrame) || 0;
    writer.writeByte(checksum);
    writer.writeLong(this.latestServerFrame);
    writeUserCommand(writer, commandWithFrame);

    this.transmit(writer.getData());
  }

  private transmit(data: Uint8Array): void {
    const packet = this.netchan.transmit(data);
    this.emit('send', packet);
  }

  private sendChallenge(): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);
    builder.writeString('getchallenge');
    this.transmit(builder.getData());
  }

  private sendConnect(challenge: number): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);
    const userinfo = `\\name\\${this.options.username}\\model\\${this.options.model}\\skin\\${this.options.skin}\\hand\\${this.options.hand ?? 0}\\fov\\${this.options.fov ?? 90}`;
    builder.writeString(`connect ${PROTOCOL_VERSION_RERELEASE} ${challenge} ${userinfo}`);
    this.transmit(builder.getData());
  }

  private sendNew(): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);
    builder.writeString('new');
    this.transmit(builder.getData());
  }

  private sendBegin(): void {
    const builder = new NetworkMessageBuilder();
    builder.writeByte(ClientCommand.stringcmd);
    builder.writeString('begin');
    this.transmit(builder.getData());
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
    this.emit('serverdata', { protocol, serverCount, gameDir, levelName });

    // Auto-respond with "new"
    this.sendNew();
    this.setState(ConnectionState.Loading);
  }

  onConfigString(index: number, str: string): void {
    this.configStrings.set(index, str);
  }

  onSpawnBaseline(entity: EntityState): void {
    this.baselines.set(entity.number, entity);
  }

  onStuffText(msg: string): void {
    this.emit('stufftext', msg);

    if (msg.startsWith('precache')) {
      // Done loading
      this.sendBegin();
      this.setState(ConnectionState.Active);
    }

    if (msg.startsWith('challenge ')) {
      const parts = msg.split(' ');
      if (parts.length > 1) {
        const challenge = parseInt(parts[1], 10);
        this.sendConnect(challenge);
      }
    }
  }

  onFrame(frame: FrameData): void {
    if (frame.serverFrame > this.latestServerFrame) {
      this.latestServerFrame = frame.serverFrame;
    }
    this.frameCRCs.set(frame.serverFrame, this.currentPacketCRC);

    const packetEntities = frame.packetEntities;
    if (!packetEntities.delta) {
      this.entities.clear();
    }
    for (const ent of packetEntities.entities) {
      this.entities.set(ent.number, ent);
    }

    this.emit('frame', frame);
  }

  onDisconnect(): void {
    this.disconnect();
  }

  onPrint(level: number, msg: string): void {
    this.emit('print', msg, level);
  }

  onCenterPrint(msg: string): void {
    this.emit('centerprint', msg);
  }

  onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {
    this.emit('sound', { flags, soundNum, volume, attenuation, offset, ent, pos });
  }

  onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
    this.emit('temp_entity', { type, pos, pos2, dir, cnt, color, ent });
  }

  onInventory(inventory: number[]): void {
    this.emit('inventory', inventory);
  }

  onMuzzleFlash(ent: number, weapon: number): void {
    this.emit('muzzleflash', ent, weapon);
  }

  onMuzzleFlash2(ent: number, weapon: number): void {
     // TODO: Emit separate event or normalized one?
  }

  onMuzzleFlash3(ent: number, weapon: number): void {
      this.emit('muzzleflash', ent, weapon);
  }

  onDownload(size: number, percent: number, data?: Uint8Array): void {
    this.emit('download', size, percent, data);
  }

  // Stubs for other handler methods
  onReconnect(): void {}
  onLayout(layout: string): void {}
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
