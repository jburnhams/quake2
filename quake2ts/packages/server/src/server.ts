import { NetServer, NetConnection } from '@quake2ts/shared';
// import { GameExports, GameImports } from '@quake2ts/game';
import { Client, ClientState } from './client.js';

export interface ServerStatic {
  initialized: boolean;
  time: number;
  snapFlag: boolean; // For frame diffing?
}

export interface ServerLevel {
  name: string;
  active: boolean;
  paused: boolean;
  time: number;
}

export class DedicatedServer {
  private netDriver: NetServer;
  private game: any | null = null; // GameExports
  private running: boolean = false;
  private frameRate: number = 10; // 10Hz tick rate
  private intervalId: NodeJS.Timeout | null = null;

  private maxClients: number = 32;
  private clients: Client[] = [];

  // State
  private svs: ServerStatic = {
    initialized: false,
    time: 0,
    snapFlag: false
  };

  private sv: ServerLevel = {
    name: '',
    active: false,
    paused: false,
    time: 0
  };

  constructor(netDriver: NetServer, maxClients: number = 32) {
    this.netDriver = netDriver;
    this.maxClients = maxClients;
    this.netDriver.onConnect(this.handleConnect.bind(this));

    // Initialize clients array
    for (let i = 0; i < this.maxClients; i++) {
      this.clients.push(new Client());
    }
  }

  public async init(port: number): Promise<void> {
    await this.netDriver.listen(port);
    this.svs.initialized = true;
    console.log(`Server initialized on port ${port}`);
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    const intervalMs = 1000 / this.frameRate;
    this.intervalId = setInterval(() => this.runFrame(), intervalMs);
    console.log(`Server loop started at ${this.frameRate}Hz`);
  }

  public stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private runFrame(): void {
    if (!this.svs.initialized) return;

    // 1. Read Packets
    this.readPackets();

    // 2. Run Game Frame
    this.runGameFrame();

    // 3. Send Client Messages
    this.sendClientMessages();
  }

  private readPackets(): void {
    // Process messages from clients
    for (const client of this.clients) {
      if (client.state === ClientState.Free) continue;

      while (client.messageBuffer.length > 0) {
        const msg = client.messageBuffer.shift();
        if (msg) {
          this.processClientMessage(client, msg);
        }
      }
    }
  }

  private processClientMessage(client: Client, msg: Uint8Array): void {
      // TODO: Parse message (NetChan_Process)
      // For now, just log
      // console.log(`Received ${msg.byteLength} bytes from client`);
  }

  private runGameFrame(): void {
    if (this.game && !this.sv.paused) {
      // this.game.RunFrame(this.sv.time);
      this.sv.time += 1000 / this.frameRate;
    }
  }

  private sendClientMessages(): void {
    // Iterate over clients and send updates
    for (const client of this.clients) {
        if (client.state === ClientState.Free) continue;

        // TODO: Build update packet
    }
  }

  private handleConnect(connection: NetConnection): void {
    console.log('New client connected');

    // Find a free client slot
    let slot = -1;
    for (let i = 0; i < this.maxClients; i++) {
      if (this.clients[i].state === ClientState.Free) {
        slot = i;
        break;
      }
    }

    if (slot === -1) {
      console.log('Server is full, rejecting connection');
      connection.close();
      return;
    }

    // Initialize client
    const client = this.clients[slot];
    client.connect(connection);
    console.log(`Client assigned to slot ${slot}`);
  }
}
