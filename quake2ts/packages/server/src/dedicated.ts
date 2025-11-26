import { WebSocketServer } from 'ws';
import { WebSocketNetDriver } from './net/nodeWsDriver.js';
import { createGame, GameExports, GameImports, GameEngine, Entity, MulticastType } from '@quake2ts/game';
import { Client, createClient, ClientState } from './client.js';
import { ClientMessageParser } from './protocol.js';
import { BinaryWriter, ServerCommand, BinaryStream, UserCommand, traceBox, CollisionModel } from '@quake2ts/shared';
import { parseBsp } from '@quake2ts/engine';
import fs from 'node:fs/promises';
import { createPlayerInventory, createPlayerWeaponStates } from '@quake2ts/game';
import { Server, ServerStatic } from './server.js';

const MAX_CLIENTS = 16;
const FRAME_RATE = 10; // 10Hz dedicated server loop (Q2 standard)
const FRAME_TIME_MS = 1000 / FRAME_RATE;

export class DedicatedServer implements GameEngine {
    private wss: WebSocketServer | null = null;
    private svs: ServerStatic;
    private sv: Server;
    private game: GameExports | null = null;
    private frameInterval: NodeJS.Timeout | null = null;

    constructor(private port: number = 27910) {
        this.svs = {
            clients: new Array(MAX_CLIENTS).fill(null)
        };
        this.sv = {
            startTime: 0,
            time: 0,
            frame: 0,
            mapName: '',
            collisionModel: null
        };
    }

    public async start(mapName: string) {
        console.log(`Starting Dedicated Server on port ${this.port}...`);
        this.sv.mapName = mapName;

        // 1. Initialize Network
        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', (ws) => {
            console.log('New connection');
            this.handleConnection(ws);
        });

        // 2. Load Map
        try {
            console.log(`Loading map ${this.sv.mapName}...`);
            // Assuming maps are local files for now. In production this would use VFS.
            // For tests/dev, we try to load relative path.
            // If file doesn't exist, we might fail or warn.
            // Note: parseBsp expects ArrayBuffer.

            // NOTE: Ideally we check if file exists. For now, try/catch.
            const mapData = await fs.readFile(this.sv.mapName);
            // Buffer to ArrayBuffer
            const arrayBuffer = mapData.buffer.slice(mapData.byteOffset, mapData.byteOffset + mapData.byteLength);
            const bspMap = parseBsp(arrayBuffer);

            // Convert BspMap to CollisionModel (Shared interface is compatible/subset)
            // Ideally we need a converter, but BspMap has nodes, planes, brushes etc.
            // traceBox expects { nodes, planes, brushes, leafBrushes, visibility? }
            // parseBsp returns BspMap which has these fields matching BspModel interface.
            this.sv.collisionModel = bspMap as unknown as CollisionModel;
            console.log(`Map loaded successfully.`);
        } catch (e) {
            console.warn('Failed to load map:', e);
            // Proceed without map (empty world)
        }

        // 3. Initialize Game
        this.sv.startTime = Date.now();
        const imports: GameImports = {
            trace: (start, mins, maxs, end, passent, contentmask) => {
                if (!this.sv.collisionModel) {
                    return {
                        fraction: 1.0,
                        endpos: { ...end },
                        allsolid: false,
                        startsolid: false,
                        plane: null,
                        surfaceFlags: 0,
                        contents: 0,
                        ent: null
                    };
                }

                const result = traceBox({
                   start,
                   end,
                   mins: mins || undefined,
                   maxs: maxs || undefined,
                   model: this.sv.collisionModel
                });

                // Wrap result to match GameTraceResult
                return {
                    allsolid: result.allsolid,
                    startsolid: result.startsolid,
                    fraction: result.fraction,
                    endpos: result.endpos,
                    plane: result.plane || null, // Ensure null if undefined
                    surfaceFlags: result.surfaceFlags || 0,
                    contents: result.contents || 0,
                    ent: null // TODO: resolve entity hit
                };
            },
            pointcontents: (p) => 0, // Empty
            linkentity: (ent) => {}, // No-op for now or handle in game
            multicast: (origin, type, event, ...args) => this.multicast(origin, type, event, ...args),
            unicast: (ent, reliable, event, ...args) => this.unicast(ent, reliable, event, ...args)
        };

        this.game = createGame(imports, this, {
            gravity: { x: 0, y: 0, z: -800 },
            deathmatch: true
        });

        this.game.init(0);
        this.game.spawnWorld();

        // 4. Start Loop
        this.frameInterval = setInterval(() => this.runFrame(), FRAME_TIME_MS);
        console.log('Server started.');
    }

    public stop() {
        if (this.frameInterval) clearInterval(this.frameInterval);
        if (this.wss) this.wss.close();
        this.game?.shutdown();
    }

    private handleConnection(ws: any) {
        // Find free client slot
        let clientIndex = -1;
        for (let i = 0; i < MAX_CLIENTS; i++) {
            if (this.svs.clients[i] === null || this.svs.clients[i]!.state === ClientState.Free) {
                clientIndex = i;
                break;
            }
        }

        if (clientIndex === -1) {
            ws.close(); // Server full
            return;
        }

        const driver = new WebSocketNetDriver();
        driver.attach(ws);

        const client = createClient(clientIndex, driver);
        this.svs.clients[clientIndex] = client;

        driver.onMessage((data) => this.onClientMessage(client, data));
        driver.onClose(() => this.onClientDisconnect(client));
    }

    private onClientMessage(client: Client, data: Uint8Array) {
        const buffer = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
            ? data.buffer
            : data.slice().buffer;

        const reader = new BinaryStream(buffer as ArrayBuffer);
        const parser = new ClientMessageParser(reader, {
            onMove: (checksum, lastFrame, cmd) => this.handleMove(client, cmd),
            onUserInfo: (info) => this.handleUserInfo(client, info),
            onStringCmd: (cmd) => this.handleStringCmd(client, cmd),
            onNop: () => {},
            onBad: () => {
                console.warn(`Bad command from client ${client.index}`);
                client.net.disconnect();
            }
        });
        parser.parseMessage();
    }

    private onClientDisconnect(client: Client) {
        console.log(`Client ${client.index} disconnected`);
        this.svs.clients[client.index] = null;
    }

    private handleMove(client: Client, cmd: UserCommand) {
        client.lastCmd = cmd;
        client.lastPacketTime = Date.now();
        // If client is not spawned, maybe spawn them?
        if (client.state === ClientState.Connected) {
             this.spawnClient(client);
        }
    }

    private handleUserInfo(client: Client, info: string) {
        client.userInfo = info;
    }

    private handleStringCmd(client: Client, cmd: string) {
        // Handle console commands
    }

    private spawnClient(client: Client) {
        if (!this.game) return;

        // Use Game Exports to spawn player properly
        const ent = this.game.clientBegin({
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
            buttons: 0,
        });

        client.edict = ent;
        client.state = ClientState.Active;

        // Send baseline/gamestate
        this.sendServerData(client);
    }

    private sendServerData(client: Client) {
       // Send svc_serverdata
       const writer = new BinaryWriter();
       writer.writeByte(ServerCommand.serverdata);
       writer.writeLong(34); // Protocol version
       writer.writeLong(this.sv.frame);
       writer.writeByte(0); // Attract loop
       writer.writeString("baseq2");
       writer.writeShort(client.index);
       writer.writeString("maps/test.bsp");
       client.net.send(writer.getData());
    }

    private SV_ReadPackets() {
        // This will eventually poll the NetDriver for all clients.
        // For now, messages are pushed directly to onClientMessage.
    }

    private runFrame() {
        if (!this.game) return;
        this.sv.frame++;

        // 1. Read network packets
        this.SV_ReadPackets();

        // 2. Run client commands
        for (const client of this.svs.clients) {
            if (client && client.state === ClientState.Active && client.edict) {
                this.game.clientThink(client.edict, client.lastCmd);
            }
        }

        // 3. Run simulation
        this.game.frame({
            frame: this.sv.frame,
            deltaMs: FRAME_TIME_MS,
            nowMs: Date.now()
        });

        // 4. Send Updates
        this.SV_SendClientMessages();
    }

    private SV_SendClientMessages() {
        // Build snapshot
        // Send to all clients
        for (const client of this.svs.clients) {
            if (client && client.state === ClientState.Active) {
                this.SV_SendClientFrame(client);
            }
        }
    }

    private SV_SendClientFrame(client: Client) {
        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.frame);
        writer.writeLong(this.sv.frame);
        writer.writeLong(0); // Delta frame
        writer.writeByte(0); // Suppress
        writer.writeByte(0); // Area bytes

        // Player info
        writer.writeByte(ServerCommand.playerinfo);
        // ... Write player state ...
        writer.writeShort(0); // flags (empty)
        writer.writeLong(0); // stats

        client.net.send(writer.getData());
    }

    // GameEngine Implementation
    trace(start: any, end: any): any {
        return { fraction: 1.0 };
    }

    multicast(origin: any, type: MulticastType, event: ServerCommand, ...args: any[]): void {
        // Send to relevant clients
    }

    unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void {
        // Find client for ent
        const client = this.svs.clients.find(c => c?.edict === ent);
        if (client) {
             // Send
        }
    }
}
