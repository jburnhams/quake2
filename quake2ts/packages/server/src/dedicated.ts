import { WebSocketServer } from 'ws';
import { WebSocketNetDriver } from './net/nodeWsDriver.js';
import { createGame, GameExports, GameImports, GameEngine, Entity, MulticastType, GameStateSnapshot } from '@quake2ts/game';
import { Client, createClient, ClientState } from './client.js';
import { ClientMessageParser } from './protocol.js';
import { BinaryWriter, ServerCommand, BinaryStream, UserCommand, traceBox, CollisionModel, UPDATE_BACKUP, MAX_CONFIGSTRINGS, MAX_EDICTS, EntityState } from '@quake2ts/shared';
import { parseBsp } from '@quake2ts/engine';
import fs from 'node:fs/promises';
import { createPlayerInventory, createPlayerWeaponStates } from '@quake2ts/game';
import { Server, ServerState, ServerStatic } from './server.js';
import { writeDeltaEntity } from './protocol/entity.js';

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
            initialized: false,
            realTime: 0,
            mapCmd: '',
            spawnCount: 0,
            clients: new Array(MAX_CLIENTS).fill(null),
            lastHeartbeat: 0,
            challenges: []
        };
        this.sv = {
            state: ServerState.Dead,
            attractLoop: false,
            loadGame: false,
            startTime: 0, // Initialize startTime
            time: 0,
            frame: 0,
            name: '',
            collisionModel: null,
            configStrings: new Array(MAX_CONFIGSTRINGS).fill(''),
            baselines: new Array(MAX_EDICTS).fill(null),
            multicastBuf: new Uint8Array(0)
        };
    }

    public async start(mapName: string) {
        console.log(`Starting Dedicated Server on port ${this.port}...`);
        this.sv.name = mapName;
        this.svs.initialized = true;
        this.svs.spawnCount++;

        // 1. Initialize Network
        this.wss = new WebSocketServer({ port: this.port });
        this.wss.on('connection', (ws) => {
            console.log('New connection');
            this.handleConnection(ws);
        });

        // 2. Load Map
        try {
            console.log(`Loading map ${this.sv.name}...`);
            this.sv.state = ServerState.Loading;

            // Assuming maps are local files for now. In production this would use VFS.
            // For tests/dev, we try to load relative path.
            // If file doesn't exist, we might fail or warn.
            // Note: parseBsp expects ArrayBuffer.

            // NOTE: Ideally we check if file exists. For now, try/catch.
            const mapData = await fs.readFile(this.sv.name);
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
        this.sv.state = ServerState.Game;

        // 4. Start Loop
        this.frameInterval = setInterval(() => this.runFrame(), FRAME_TIME_MS);
        console.log('Server started.');
    }

    public stop() {
        if (this.frameInterval) clearInterval(this.frameInterval);
        if (this.wss) this.wss.close();
        this.game?.shutdown();
        this.sv.state = ServerState.Dead;
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

        // Push raw message to queue
        client.messageQueue.push(new Uint8Array(buffer as ArrayBuffer));
    }

    private onClientDisconnect(client: Client) {
        console.log(`Client ${client.index} disconnected`);
        this.svs.clients[client.index] = null;
    }

    private handleMove(client: Client, cmd: UserCommand) {
        client.lastCmd = cmd;
        client.lastMessage = this.sv.frame;
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
        for (const client of this.svs.clients) {
            if (!client || client.state === ClientState.Free) continue;

            while (client.messageQueue.length > 0) {
                const data = client.messageQueue.shift();
                if (!data) continue;

                const reader = new BinaryStream(data.buffer);
                const parser = new ClientMessageParser(reader, {
                    onMove: (checksum, lastFrame, cmd) => this.handleMove(client, cmd),
                    onUserInfo: (info) => this.handleUserInfo(client, info),
                    onStringCmd: (cmd) => this.handleStringCmd(client, cmd),
                    onNop: () => {},
                    onBad: () => {
                        console.warn(`Bad command from client ${client.index}`);
                        // Don't disconnect immediately in test/dev, but normally yes
                    }
                });

                try {
                    parser.parseMessage();
                } catch (e) {
                    console.error(`Error parsing message from client ${client.index}:`, e);
                }
            }
        }
    }

    private runFrame() {
        if (!this.game) return;
        this.sv.frame++;
        this.sv.time += 100; // 100ms per frame

        // 1. Read network packets
        this.SV_ReadPackets();

        // 2. Run client commands
        for (const client of this.svs.clients) {
            if (client && client.state === ClientState.Active && client.edict) {
                // TODO: Process command queue, apply rate limiting
                this.game.clientThink(client.edict, client.lastCmd);
            }
        }

        // 3. Run simulation
        const snapshot = this.game.frame({
            frame: this.sv.frame,
            deltaMs: FRAME_TIME_MS,
            nowMs: Date.now()
        });

        // 4. Send Updates
        if (snapshot && snapshot.state) {
            this.SV_SendClientMessages(snapshot.state);
        }
    }

    private SV_SendClientMessages(snapshot: GameStateSnapshot) {
        // Build snapshot
        // Send to all clients
        for (const client of this.svs.clients) {
            if (client && client.state === ClientState.Active) {
                this.SV_SendClientFrame(client, snapshot);
            }
        }
    }

    private SV_SendClientFrame(client: Client, snapshot: GameStateSnapshot) {
        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.frame);
        writer.writeLong(this.sv.frame);
        writer.writeLong(0); // Delta frame (0 = full update)
        writer.writeByte(0); // Suppress
        writer.writeByte(0); // Area bytes

        // Player info
        writer.writeByte(ServerCommand.playerinfo);
        // ... Write player state ...
        // Placeholder for now
        writer.writeShort(0); // flags (empty)
        writer.writeLong(0); // stats

        // Packet entities
        writer.writeByte(ServerCommand.packetentities);

        // Use proper delta compression via writeDeltaEntity
        // For now, we compare against NULL state (force full update)
        // TODO: Use client.frames to find a baseline
        const entities = snapshot.packetEntities || [];

        for (const entity of entities) {
            // Write delta
            // from = null (for now), to = entity, force = false, newEntity = true
            // If newEntity is true, from is ignored anyway.

            // Note: In real delta compression, we'd look up old state from client.frames
            // based on client.lastFrame.

            writeDeltaEntity({} as EntityState, entity, writer, false, true);
        }

        // Write 0 to signal end of entities
        writer.writeShort(0);

        client.net.send(writer.getData());

        // Update client history
        client.lastFrame = this.sv.frame;
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
