import { WebSocketNetDriver } from './net/nodeWsDriver.js';
import { createGame, GameExports, GameImports, GameEngine, Entity, MulticastType, GameStateSnapshot, Solid } from '@quake2ts/game';
import { Client, createClient, ClientState } from './client.js';
import { ClientMessageParser } from './protocol.js';
import { BinaryWriter, ServerCommand, BinaryStream, UserCommand, traceBox, CollisionModel, UPDATE_BACKUP, MAX_CONFIGSTRINGS, MAX_EDICTS, EntityState, CollisionEntityIndex, inPVS, inPHS, crc8, NetDriver } from '@quake2ts/shared';
import { parseBsp } from '@quake2ts/engine';
import fs from 'node:fs/promises';
import { createPlayerInventory, createPlayerWeaponStates } from '@quake2ts/game';
import { Server, ServerState, ServerStatic } from './server.js';
import { writeDeltaEntity, writeRemoveEntity } from '@quake2ts/shared';
import { writePlayerState, ProtocolPlayerState } from './protocol/player.js';
import { writeServerCommand } from './protocol/write.js';
import { Vec3, lerpAngle } from '@quake2ts/shared';
import { NetworkTransport } from './transport.js';
import { WebSocketTransport } from './transports/websocket.js';

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

const DEFAULT_MAX_CLIENTS = 16;
const FRAME_RATE = 10; // 10Hz dedicated server loop (Q2 standard)
const FRAME_TIME_MS = 1000 / FRAME_RATE;

// Lag Compensation History
interface EntityHistory {
    time: number;
    origin: Vec3;
    mins: Vec3;
    maxs: Vec3;
    angles: Vec3;
}

interface EntityBackup {
    origin: Vec3;
    mins: Vec3;
    maxs: Vec3;
    angles: Vec3;
    link: boolean;
}

export interface ClientInfo {
    id: number;
    name: string;
    ping: number;
    address: string;
}

export interface ServerOptions {
    mapName?: string;
    maxPlayers?: number;
    deathmatch?: boolean;
    port?: number;
    transport?: NetworkTransport;
}

export class DedicatedServer implements GameEngine {
    private transport: NetworkTransport;
    private svs: ServerStatic;
    private sv: Server;
    private game: GameExports | null = null;
    private frameTimeout: NodeJS.Timeout | null = null;
    private entityIndex: CollisionEntityIndex | null = null;

    // History buffer: Map<EntityIndex, HistoryArray>
    private history = new Map<number, EntityHistory[]>();
    private backup = new Map<number, EntityBackup>();

    // Events
    public onClientConnected?: (clientId: number, name: string) => void;
    public onClientDisconnected?: (clientId: number) => void;
    public onServerError?: (error: Error) => void;

    private options: ServerOptions;

    constructor(optionsOrPort: ServerOptions | number = {}) {
        const options = typeof optionsOrPort === 'number' ? { port: optionsOrPort } : optionsOrPort;
        this.options = {
            port: 27910,
            maxPlayers: DEFAULT_MAX_CLIENTS,
            deathmatch: true,
            ...options
        };

        this.transport = this.options.transport || new WebSocketTransport();

        this.svs = {
            initialized: false,
            realTime: 0,
            mapCmd: '',
            spawnCount: 0,
            clients: new Array(this.options.maxPlayers!).fill(null),
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
        this.entityIndex = new CollisionEntityIndex();
    }

    public setTransport(transport: NetworkTransport) {
        if (this.svs.initialized) {
            throw new Error('Cannot set transport after server started');
        }
        this.transport = transport;
    }

    public async startServer(mapName?: string) {
        const map = mapName || this.options.mapName;
        if (!map) {
            throw new Error('No map specified');
        }
        await this.start(map);
    }

    public stopServer() {
        this.stop();
    }

    public kickPlayer(clientId: number) {
        if (clientId < 0 || clientId >= this.svs.clients.length) return;
        const client = this.svs.clients[clientId];
        if (client && client.state >= ClientState.Connected) {
            console.log(`Kicking client ${clientId}`);
            // Send disconnect message if possible
            if (client.netchan) {
                const writer = new BinaryWriter();
                writer.writeByte(ServerCommand.print);
                writer.writeByte(2);
                writer.writeString('Kicked by server.\n');
                try {
                    const packet = client.netchan.transmit(writer.getData());
                    client.net.send(packet);
                } catch (e) {}
            }
            this.dropClient(client);
        }
    }

    public async changeMap(mapName: string) {
        console.log(`Changing map to ${mapName}`);

        // Notify clients?
        this.multicast(
            {x:0,y:0,z:0},
            MulticastType.All,
            ServerCommand.print,
            2,
            `Changing map to ${mapName}...\n`
        );

        // Stop current game loop
        if (this.frameTimeout) clearTimeout(this.frameTimeout);

        // Reset Server State
        this.sv.state = ServerState.Loading;
        this.sv.collisionModel = null;
        this.sv.time = 0;
        this.sv.frame = 0;
        this.sv.configStrings.fill('');
        this.sv.baselines.fill(null);
        this.history.clear();
        this.entityIndex = new CollisionEntityIndex();

        // Load new Map
        await this.loadMap(mapName);

        // Re-init game
        this.initGame();

        // Send new serverdata to all connected clients and respawn them
        for (const client of this.svs.clients) {
            if (client && client.state >= ClientState.Connected) {
                // Reset client game state
                client.edict = null; // Will be respawned
                client.state = ClientState.Connected; // Move back to connected state to trigger spawn

                // Send new serverdata
                this.sendServerData(client);

                // Force them to reload/precache
                client.netchan.writeReliableByte(ServerCommand.stufftext);
                client.netchan.writeReliableString(`map ${mapName}\n`);

                // Trigger spawn
                this.handleBegin(client);
            }
        }

        // Resume loop
        this.runFrame();
    }

    public getConnectedClients(): ClientInfo[] {
        const list: ClientInfo[] = [];
        for (const client of this.svs.clients) {
            if (client && client.state >= ClientState.Connected) {
                list.push({
                    id: client.index,
                    name: 'Player', // TODO: Parse userinfo for name
                    ping: client.ping,
                    address: 'unknown'
                });
            }
        }
        return list;
    }

    private async start(mapName: string) {
        console.log(`Starting Dedicated Server on port ${this.options.port}...`);
        this.sv.name = mapName;
        this.svs.initialized = true;
        this.svs.spawnCount++;

        // 1. Initialize Network
        this.transport.onConnection((driver, info) => {
            console.log('New connection', info ? `from ${info.socket?.remoteAddress}` : '');
            this.handleConnection(driver, info);
        });

        this.transport.onError((err) => {
            if (this.onServerError) this.onServerError(err);
        });

        await this.transport.listen(this.options.port!);

        // 2. Load Map
        await this.loadMap(mapName);

        // 3. Initialize Game
        this.initGame();

        // 4. Start Loop
        this.runFrame();
        console.log('Server started.');
    }

    private async loadMap(mapName: string) {
        try {
            console.log(`Loading map ${mapName}...`);
            this.sv.state = ServerState.Loading;
            this.sv.name = mapName;

            const mapData = await fs.readFile(mapName);
            const arrayBuffer = mapData.buffer.slice(mapData.byteOffset, mapData.byteOffset + mapData.byteLength);
            const bspMap = parseBsp(arrayBuffer);

            // Convert BspMap to CollisionModel manually
            const planes = bspMap.planes.map(p => {
                const normal = { x: p.normal[0], y: p.normal[1], z: p.normal[2] };
                let signbits = 0;
                if (normal.x < 0) signbits |= 1;
                if (normal.y < 0) signbits |= 2;
                if (normal.z < 0) signbits |= 4;
                return {
                    normal,
                    dist: p.dist,
                    type: p.type,
                    signbits
                };
            });

            const nodes = bspMap.nodes.map(n => ({
                plane: planes[n.planeIndex],
                children: n.children
            }));

            const leafBrushes: number[] = [];
            const leaves = bspMap.leafs.map((l, i) => {
                const brushes = bspMap.leafLists.leafBrushes[i];
                const firstLeafBrush = leafBrushes.length;
                leafBrushes.push(...brushes);
                return {
                    contents: l.contents,
                    cluster: l.cluster,
                    area: l.area,
                    firstLeafBrush,
                    numLeafBrushes: brushes.length
                };
            });

            const brushes = bspMap.brushes.map(b => {
                const sides = [];
                for (let i = 0; i < b.numSides; i++) {
                    const sideIndex = b.firstSide + i;
                    const bspSide = bspMap.brushSides[sideIndex];
                    const plane = planes[bspSide.planeIndex];
                    const texInfo = bspMap.texInfo[bspSide.texInfo];
                    const surfaceFlags = texInfo ? texInfo.flags : 0;

                    sides.push({
                        plane,
                        surfaceFlags
                    });
                }
                return {
                    contents: b.contents,
                    sides,
                    checkcount: 0
                };
            });

            const bmodels = bspMap.models.map(m => ({
                mins: { x: m.mins[0], y: m.mins[1], z: m.mins[2] },
                maxs: { x: m.maxs[0], y: m.maxs[1], z: m.maxs[2] },
                origin: { x: m.origin[0], y: m.origin[1], z: m.origin[2] },
                headnode: m.headNode
            }));

            let visibility;
            if (bspMap.visibility) {
                visibility = {
                    numClusters: bspMap.visibility.numClusters,
                    clusters: bspMap.visibility.clusters
                };
            }

            this.sv.collisionModel = {
                planes,
                nodes,
                leaves,
                brushes,
                leafBrushes,
                bmodels,
                visibility
            };

            console.log(`Map loaded successfully.`);
        } catch (e) {
            console.warn('Failed to load map:', e);
            if (this.onServerError) this.onServerError(e as Error);
        }
    }

    private initGame() {
        this.sv.startTime = Date.now();
        const imports: GameImports = {
            trace: (start, mins, maxs, end, passent, contentmask) => {
                if (this.entityIndex) {
                    const result = this.entityIndex.trace({
                        start,
                        end,
                        mins: mins || undefined,
                        maxs: maxs || undefined,
                        model: this.sv.collisionModel as CollisionModel,
                        passId: passent ? passent.index : undefined,
                        contentMask: contentmask
                    });

                    let hitEntity: Entity | null = null;
                    if (result.entityId !== null && result.entityId !== undefined && this.game) {
                        hitEntity = this.game.entities.getByIndex(result.entityId) ?? null;
                    }

                    return {
                        allsolid: result.allsolid,
                        startsolid: result.startsolid,
                        fraction: result.fraction,
                        endpos: result.endpos,
                        plane: result.plane || null,
                        surfaceFlags: result.surfaceFlags || 0,
                        contents: result.contents || 0,
                        ent: hitEntity
                    };
                }

                const worldResult = this.sv.collisionModel ? traceBox({
                   start,
                   end,
                   mins: mins || undefined,
                   maxs: maxs || undefined,
                   model: this.sv.collisionModel,
                   contentMask: contentmask
                }) : {
                    fraction: 1.0,
                    endpos: { ...end },
                    allsolid: false,
                    startsolid: false,
                    plane: null,
                    surfaceFlags: 0,
                    contents: 0
                };

                return {
                    allsolid: worldResult.allsolid,
                    startsolid: worldResult.startsolid,
                    fraction: worldResult.fraction,
                    endpos: worldResult.endpos,
                    plane: worldResult.plane || null,
                    surfaceFlags: worldResult.surfaceFlags || 0,
                    contents: worldResult.contents || 0,
                    ent: null
                };
            },
            pointcontents: (p) => 0,
            linkentity: (ent) => {
                if (!this.entityIndex) return;
                this.entityIndex.link({
                    id: ent.index,
                    origin: ent.origin,
                    mins: ent.mins,
                    maxs: ent.maxs,
                    contents: ent.solid === 0 ? 0 : 1,
                    surfaceFlags: 0
                });
            },
            areaEdicts: (mins, maxs) => {
                 if (!this.entityIndex) return [];
                 return this.entityIndex.gatherTriggerTouches({ x: 0, y: 0, z: 0 }, mins, maxs, 0xFFFFFFFF);
            },
            multicast: (origin, type, event, ...args) => this.multicast(origin, type, event, ...args),
            unicast: (ent, reliable, event, ...args) => this.unicast(ent, reliable, event, ...args),
            configstring: (index, value) => this.SV_SetConfigString(index, value),
            serverCommand: (cmd) => { console.log(`Server command: ${cmd}`); },
            setLagCompensation: (active, client, lagMs) => this.setLagCompensation(active, client, lagMs)
        };

        this.game = createGame(imports, this, {
            gravity: { x: 0, y: 0, z: -800 },
            deathmatch: this.options.deathmatch !== false
        });

        this.game.init(0);
        this.game.spawnWorld();

        this.populateBaselines();

        this.sv.state = ServerState.Game;
    }

    private populateBaselines() {
        if (!this.game) return;

        this.game.entities.forEachEntity((ent) => {
            if (ent.index >= MAX_EDICTS) return;
            if (ent.modelindex > 0 || ent.solid !== Solid.Not) {
                this.sv.baselines[ent.index] = this.entityToState(ent);
            }
        });
    }

    private entityToState(ent: Entity): EntityState {
        return {
            number: ent.index,
            origin: { ...ent.origin },
            angles: { ...ent.angles },
            modelIndex: ent.modelindex,
            frame: ent.frame,
            skinNum: ent.skin,
            effects: ent.effects,
            renderfx: ent.renderfx,
            solid: ent.solid,
            sound: ent.sounds,
            event: 0
        };
    }

    public stop() {
        if (this.frameTimeout) clearTimeout(this.frameTimeout);
        this.transport.close();
        this.game?.shutdown();
        this.sv.state = ServerState.Dead;
    }

    private handleConnection(driver: NetDriver, info?: any) {
        let clientIndex = -1;
        for (let i = 0; i < this.options.maxPlayers!; i++) {
            if (this.svs.clients[i] === null || this.svs.clients[i]!.state === ClientState.Free) {
                clientIndex = i;
                break;
            }
        }

        if (clientIndex === -1) {
            console.log('Server full, rejecting connection');
            driver.disconnect();
            return;
        }

        const client = createClient(clientIndex, driver);
        client.lastMessage = this.sv.frame;
        client.lastCommandTime = Date.now();
        this.svs.clients[clientIndex] = client;

        console.log(`Client ${clientIndex} attached to slot from ${info?.socket?.remoteAddress || 'unknown'}`);

        driver.onMessage((data) => this.onClientMessage(client, data));
        driver.onClose(() => this.onClientDisconnect(client));
    }

    private onClientMessage(client: Client, data: Uint8Array) {
        const buffer = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
            ? data.buffer
            : data.slice().buffer;

        client.messageQueue.push(new Uint8Array(buffer as ArrayBuffer));
    }

    private onClientDisconnect(client: Client) {
        console.log(`Client ${client.index} disconnected`);
        if (client.edict && this.game) {
            this.game.clientDisconnect(client.edict);
        }

        if (this.onClientDisconnected) {
            this.onClientDisconnected(client.index);
        }

        client.state = ClientState.Free;

        this.svs.clients[client.index] = null;
        if (this.entityIndex && client.edict) {
            this.entityIndex.unlink(client.edict.index);
        }
    }

    private dropClient(client: Client) {
        if (client.net) {
             client.net.disconnect();
        }
    }

    private handleMove(client: Client, cmd: UserCommand, checksum: number, lastFrame: number) {
        if (lastFrame > 0 && lastFrame <= client.lastFrame && lastFrame > client.lastFrame - UPDATE_BACKUP) {
             const frameIdx = lastFrame % UPDATE_BACKUP;
             const frame = client.frames[frameIdx];

             if (frame.packetCRC !== checksum) {
                 console.warn(`Client ${client.index} checksum mismatch for frame ${lastFrame}: expected ${frame.packetCRC}, got ${checksum}`);
             }
        }

        client.lastCmd = cmd;
        client.lastMessage = this.sv.frame;
        client.commandCount++;
    }

    private handleUserInfo(client: Client, info: string) {
        client.userInfo = info;
    }

    private handleStringCmd(client: Client, cmd: string) {
        console.log(`Client ${client.index} stringcmd: ${cmd}`);
        if (cmd === 'getchallenge') {
            this.handleGetChallenge(client);
        } else if (cmd.startsWith('connect ')) {
            const userInfo = cmd.substring(8);
            this.handleConnect(client, userInfo);
        } else if (cmd === 'begin') {
            this.handleBegin(client);
        } else if (cmd === 'status') {
            this.handleStatus(client);
        }
    }

    private handleStatus(client: Client) {
        let activeClients = 0;
        for (const c of this.svs.clients) {
            if (c && c.state >= ClientState.Connected) {
                activeClients++;
            }
        }

        let status = `map: ${this.sv.name}\n`;
        status += `players: ${activeClients} active (${this.options.maxPlayers} max)\n\n`;
        status += `num score ping name            lastmsg address               qport rate\n`;
        status += `--- ----- ---- --------------- ------- --------------------- ----- -----\n`;

        for (const c of this.svs.clients) {
            if (c && c.state >= ClientState.Connected) {
                 const score = 0;
                 const ping = 0;
                 const lastMsg = this.sv.frame - c.lastMessage;
                 const address = 'unknown';
                 status += `${c.index.toString().padStart(3)} ${score.toString().padStart(5)} ${ping.toString().padStart(4)} ${c.userInfo.substring(0, 15).padEnd(15)} ${lastMsg.toString().padStart(7)} ${address.padEnd(21)} ${c.netchan.qport.toString().padStart(5)} 0\n`;
            }
        }

        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.print);
        writer.writeByte(2);
        writer.writeString(status);
        const packet = client.netchan.transmit(writer.getData());
        client.net.send(packet);
    }

    private handleGetChallenge(client: Client) {
        const challenge = Math.floor(Math.random() * 1000000) + 1;
        client.challenge = challenge;

        const writer = new BinaryWriter();
        writer.writeByte(ServerCommand.stufftext);
        writer.writeString(`challenge ${challenge}\n`);
        const packet = client.netchan.transmit(writer.getData());
        client.net.send(packet);
    }

    private handleConnect(client: Client, userInfo: string) {
        if (!this.game) return;

        const result = this.game.clientConnect(client.edict || null, userInfo);
        if (result === true) {
            client.state = ClientState.Connected;
            client.userInfo = userInfo;
            console.log(`Client ${client.index} connected: ${userInfo}`);

            if (this.onClientConnected) {
                // Extract name from userinfo if possible, default to Player
                this.onClientConnected(client.index, 'Player');
            }

            try {
                this.sendServerData(client);

                client.netchan.writeReliableByte(ServerCommand.stufftext);
                client.netchan.writeReliableString("precache\n");

                const packet = client.netchan.transmit();
                client.net.send(packet);
            } catch (e) {
                console.warn(`Client ${client.index} reliable buffer overflow or connection error`);
                this.dropClient(client);
            }
        } else {
            console.log(`Client ${client.index} rejected: ${result}`);
            const writer = new BinaryWriter();
            writer.writeByte(ServerCommand.print);
            writer.writeByte(2);
            writer.writeString(`Connection rejected: ${result}\n`);
            const packet = client.netchan.transmit(writer.getData());
            client.net.send(packet);
        }
    }

    private handleBegin(client: Client) {
        if (client.state === ClientState.Connected) {
            this.spawnClient(client);
        }
    }

    private spawnClient(client: Client) {
        if (!this.game) return;

        const ent = this.game.clientBegin({
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
            buttons: 0,
            pm_type: 0,
            pm_time: 0,
            pm_flags: 0,
            gun_frame: 0,
            rdflags: 0,
            fov: 90,
            pers: {
                connected: true,
                inventory: [],
                health: 100,
                max_health: 100,
                savedFlags: 0,
                selected_item: 0
            }
        });

        client.edict = ent;
        client.state = ClientState.Active;

        console.log(`Client ${client.index} entered game`);
    }

    private sendServerData(client: Client) {
        client.netchan.writeReliableByte(ServerCommand.serverdata);
        client.netchan.writeReliableLong(34);
        client.netchan.writeReliableLong(this.sv.frame);
        client.netchan.writeReliableByte(0);
        client.netchan.writeReliableString("baseq2");
        client.netchan.writeReliableShort(client.index);
        client.netchan.writeReliableString(this.sv.name || "maps/test.bsp");

        for (let i = 0; i < MAX_CONFIGSTRINGS; i++) {
            if (this.sv.configStrings[i]) {
                client.netchan.writeReliableByte(ServerCommand.configstring);
                client.netchan.writeReliableShort(i);
                client.netchan.writeReliableString(this.sv.configStrings[i]);
            }
        }

        const baselineWriter = new BinaryWriter();

        for (let i = 0; i < MAX_EDICTS; i++) {
            if (this.sv.baselines[i]) {
                baselineWriter.reset();
                baselineWriter.writeByte(ServerCommand.spawnbaseline);
                writeDeltaEntity({} as EntityState, this.sv.baselines[i]!, baselineWriter, true, true);

                const data = baselineWriter.getData();
                for(let j=0; j<data.length; j++) {
                    client.netchan.writeReliableByte(data[j]);
                }
            }
        }
    }

    private SV_SetConfigString(index: number, value: string) {
        if (index < 0 || index >= MAX_CONFIGSTRINGS) return;

        this.sv.configStrings[index] = value;

        for (const client of this.svs.clients) {
            if (client && client.state >= ClientState.Connected) {
                if (client.netchan) {
                    try {
                        client.netchan.writeReliableByte(ServerCommand.configstring);
                        client.netchan.writeReliableShort(index);
                        client.netchan.writeReliableString(value);

                        const packet = client.netchan.transmit();
                        client.net.send(packet);
                    } catch (e) {
                        console.warn(`Client ${client.index} reliable buffer overflow`);
                        this.dropClient(client);
                    }
                }
            }
        }
    }

    private SV_WriteConfigString(writer: BinaryWriter, index: number, value: string) {
        writer.writeByte(ServerCommand.configstring);
        writer.writeShort(index);
        writer.writeString(value);
    }

    private SV_ReadPackets() {
        for (const client of this.svs.clients) {
            if (!client || client.state === ClientState.Free) continue;

            while (client.messageQueue.length > 0) {
                const rawData = client.messageQueue.shift();
                if (!rawData) continue;

                if (rawData.byteLength >= 10) {
                    const view = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
                    const incomingQPort = view.getUint16(8, true);
                    if (client.netchan.qport !== incomingQPort) {
                        client.netchan.qport = incomingQPort;
                    }
                }

                const data = client.netchan.process(rawData);
                if (!data) {
                    continue;
                }

                if (data.length === 0) {
                    continue;
                }

                const reader = new BinaryStream(data.buffer);
                const parser = new ClientMessageParser(reader, {
                    onMove: (checksum, lastFrame, cmd) => this.handleMove(client, cmd, checksum, lastFrame),
                    onUserInfo: (info) => this.handleUserInfo(client, info),
                    onStringCmd: (cmd) => this.handleStringCmd(client, cmd),
                    onNop: () => {},
                    onBad: () => {
                        console.warn(`Bad command from client ${client.index}`);
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

        const startTime = Date.now();

        this.sv.frame++;
        this.sv.time += 100; // 100ms per frame

        // 1. Read network packets
        this.SV_ReadPackets();

        // 2. Run client commands
        for (const client of this.svs.clients) {
            if (!client || client.state === ClientState.Free) continue;

            if (client.edict && client.edict.client) {
                client.edict.client.ping = client.ping;
            }

            if (client.state >= ClientState.Connected) {
                 const timeoutFrames = 300;
                 if (this.sv.frame - client.lastMessage > timeoutFrames) {
                     console.log(`Client ${client.index} timed out`);
                     this.dropClient(client);
                     continue;
                 }
            }

            if (client && client.state === ClientState.Active && client.edict) {
                const now = Date.now();
                if (now - client.lastCommandTime >= 1000) {
                    client.lastCommandTime = now;
                    client.commandCount = 0;
                }

                if (client.commandCount > 200) {
                     console.warn(`Client ${client.index} kicked for command flooding (count: ${client.commandCount})`);
                     this.dropClient(client);
                     continue;
                }

                this.game.clientThink(client.edict, client.lastCmd);
            }
        }

        // 3. Run simulation
        const snapshot = this.game.frame({
            frame: this.sv.frame,
            deltaMs: FRAME_TIME_MS,
            nowMs: Date.now()
        });

        // 3.1 Record History for Lag Compensation
        this.recordHistory();

        // 4. Send Updates
        if (snapshot && snapshot.state) {
            this.SV_SendClientMessages(snapshot.state);
        }

        const endTime = Date.now();
        const elapsed = endTime - startTime;
        const sleepTime = Math.max(0, FRAME_TIME_MS - elapsed);

        if (this.sv.state === ServerState.Game) {
            this.frameTimeout = setTimeout(() => this.runFrame(), sleepTime);
        }
    }

    private SV_SendClientMessages(snapshot: GameStateSnapshot) {
        for (const client of this.svs.clients) {
            if (client && client.state === ClientState.Active) {
                this.SV_SendClientFrame(client, snapshot);
            }
        }
    }

    private SV_SendClientFrame(client: Client, snapshot: GameStateSnapshot) {
        const MTU = 1400;
        const writer = new BinaryWriter(MTU);
        writer.writeByte(ServerCommand.frame);
        writer.writeLong(this.sv.frame);

        let deltaFrame = 0;
        if (client.lastFrame && client.lastFrame < this.sv.frame && client.lastFrame >= this.sv.frame - UPDATE_BACKUP) {
            deltaFrame = client.lastFrame;
        }

        writer.writeLong(deltaFrame);
        writer.writeByte(0);
        writer.writeByte(0);

        writer.writeByte(ServerCommand.playerinfo);

        const ps: ProtocolPlayerState = {
            pm_type: snapshot.pmType,
            origin: snapshot.origin,
            velocity: snapshot.velocity,
            pm_time: snapshot.pm_time,
            pm_flags: snapshot.pmFlags,
            gravity: Math.abs(snapshot.gravity.z),
            delta_angles: snapshot.deltaAngles,
            viewoffset: { x: 0, y: 0, z: 22 },
            viewangles: snapshot.viewangles,
            kick_angles: snapshot.kick_angles,
            gun_index: snapshot.gunindex,
            gun_frame: snapshot.gun_frame,
            gun_offset: snapshot.gunoffset,
            gun_angles: snapshot.gunangles,
            blend: snapshot.blend,
            fov: snapshot.fov,
            rdflags: snapshot.rdflags,
            stats: snapshot.stats
        };

        writePlayerState(writer, ps);

        writer.writeByte(ServerCommand.packetentities);

        const entities = snapshot.packetEntities || [];
        const currentEntityIds: number[] = [];

        const frameIdx = this.sv.frame % UPDATE_BACKUP;
        const currentFrame = client.frames[frameIdx];
        currentFrame.entities = entities;

        let oldEntities: EntityState[] = [];
        if (deltaFrame > 0) {
            const oldFrameIdx = deltaFrame % UPDATE_BACKUP;
            oldEntities = client.frames[oldFrameIdx].entities;
        }

        for (const entityState of currentFrame.entities) {
            if (writer.getOffset() > MTU - 200) {
                console.warn('Packet MTU limit reached, dropping remaining entities');
                break;
            }

            currentEntityIds.push(entityState.number);

            const oldState = oldEntities.find(e => e.number === entityState.number);

            if (oldState) {
                 writeDeltaEntity(oldState, entityState, writer, false, false);
            } else {
                 writeDeltaEntity({} as EntityState, entityState, writer, false, true);
            }
        }

        for (const oldId of client.lastPacketEntities) {
            if (writer.getOffset() > MTU - 10) {
                console.warn('Packet MTU limit reached, dropping remaining removals');
                break;
            }

            if (!currentEntityIds.includes(oldId)) {
                writeRemoveEntity(oldId, writer);
            }
        }

        writer.writeShort(0);

        const frameData = writer.getData();
        currentFrame.packetCRC = crc8(frameData);

        const packet = client.netchan.transmit(frameData);
        client.net.send(packet);

        client.lastFrame = this.sv.frame;
        client.lastPacketEntities = currentEntityIds;
    }

    // GameEngine Implementation
    trace(start: any, end: any): any {
        return { fraction: 1.0 };
    }

    multicast(origin: any, type: MulticastType, event: ServerCommand, ...args: any[]): void {
        const writer = new BinaryWriter();

        writeServerCommand(writer, event, ...args);

        const data = writer.getData();
        const reliable = false;

        for (const client of this.svs.clients) {
            if (!client || client.state < ClientState.Active || !client.edict) {
                continue;
            }

            let send = false;
            switch (type) {
                case MulticastType.All:
                    send = true;
                    break;
                case MulticastType.Pvs:
                    if (this.sv.collisionModel) {
                        send = inPVS(origin, client.edict.origin, this.sv.collisionModel);
                    } else {
                        send = true;
                    }
                    break;
                case MulticastType.Phs:
                    if (this.sv.collisionModel) {
                        send = inPHS(origin, client.edict.origin, this.sv.collisionModel);
                    } else {
                        send = true;
                    }
                    break;
            }

            if (send) {
                if (reliable) {
                    try {
                        for (let i = 0; i < data.length; i++) {
                            client.netchan.writeReliableByte(data[i]);
                        }
                    } catch (e) {
                    }
                } else {
                    const packet = client.netchan.transmit(data);
                    client.net.send(packet);
                }
            }
        }
    }

    unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void {
        const client = this.svs.clients.find(c => c?.edict === ent);
        if (client && client.state >= ClientState.Connected) {
            const writer = new BinaryWriter();
            writeServerCommand(writer, event, ...args);
            const data = writer.getData();

            if (reliable) {
                try {
                    for (let i = 0; i < data.length; i++) {
                        client.netchan.writeReliableByte(data[i]);
                    }
                    const packet = client.netchan.transmit();
                    client.net.send(packet);
                } catch (e) {
                    console.warn(`Client ${client.index} reliable buffer overflow in unicast`);
                    this.dropClient(client);
                }
            } else {
                const packet = client.netchan.transmit(data);
                client.net.send(packet);
            }
        }
    }

    configstring(index: number, value: string): void {
        this.SV_SetConfigString(index, value);
    }

    private recordHistory() {
        if (!this.game) return;
        const now = Date.now();
        const HISTORY_MAX_MS = 1000;

        this.game.entities.forEachEntity((ent) => {
            if (ent.solid !== Solid.Not || ent.takedamage) {
                let hist = this.history.get(ent.index);
                if (!hist) {
                    hist = [];
                    this.history.set(ent.index, hist);
                }

                hist.push({
                    time: now,
                    origin: { ...ent.origin },
                    mins: { ...ent.mins },
                    maxs: { ...ent.maxs },
                    angles: { ...ent.angles }
                });

                while (hist.length > 0 && hist[0].time < now - HISTORY_MAX_MS) {
                    hist.shift();
                }
            }
        });
    }

    setLagCompensation(active: boolean, client?: Entity, lagMs?: number): void {
        if (!this.game || !this.entityIndex) return;

        if (active) {
            if (!client || lagMs === undefined) return;

            const now = Date.now();
            const targetTime = now - lagMs;

            this.game.entities.forEachEntity((ent) => {
                if (ent === client) return;
                if (ent.solid === Solid.Not && !ent.takedamage) return;

                const hist = this.history.get(ent.index);
                if (!hist || hist.length === 0) return;

                let i = hist.length - 1;
                while (i >= 0 && hist[i].time > targetTime) {
                    i--;
                }

                if (i < 0) {
                    i = 0;
                }

                const s1 = hist[i];
                const s2 = (i + 1 < hist.length) ? hist[i + 1] : s1;

                let frac = 0;
                if (s1.time !== s2.time) {
                    frac = (targetTime - s1.time) / (s2.time - s1.time);
                }
                if (frac < 0) frac = 0;
                if (frac > 1) frac = 1;

                const origin = {
                    x: s1.origin.x + (s2.origin.x - s1.origin.x) * frac,
                    y: s1.origin.y + (s2.origin.y - s1.origin.y) * frac,
                    z: s1.origin.z + (s2.origin.z - s1.origin.z) * frac
                };

                const angles = {
                    x: lerpAngle(s1.angles.x, s2.angles.x, frac),
                    y: lerpAngle(s1.angles.y, s2.angles.y, frac),
                    z: lerpAngle(s1.angles.z, s2.angles.z, frac)
                };

                this.backup.set(ent.index, {
                    origin: { ...ent.origin },
                    mins: { ...ent.mins },
                    maxs: { ...ent.maxs },
                    angles: { ...ent.angles },
                    link: true
                });

                ent.origin = origin;
                ent.angles = angles;
                 ent.mins = {
                    x: s1.mins.x + (s2.mins.x - s1.mins.x) * frac,
                    y: s1.mins.y + (s2.mins.y - s1.mins.y) * frac,
                    z: s1.mins.z + (s2.mins.z - s1.mins.z) * frac
                };
                 ent.maxs = {
                    x: s1.maxs.x + (s2.maxs.x - s1.maxs.x) * frac,
                    y: s1.maxs.y + (s2.maxs.y - s1.maxs.y) * frac,
                    z: s1.maxs.z + (s2.maxs.z - s1.maxs.z) * frac
                };

                this.entityIndex!.link({
                    id: ent.index,
                    origin: ent.origin,
                    mins: ent.mins,
                    maxs: ent.maxs,
                    contents: ent.solid === 0 ? 0 : 1,
                    surfaceFlags: 0
                });
            });

        } else {
            this.backup.forEach((state, id) => {
                const ent = this.game?.entities.getByIndex(id);
                if (ent) {
                    ent.origin = state.origin;
                    ent.mins = state.mins;
                    ent.maxs = state.maxs;
                    ent.angles = state.angles;

                    this.entityIndex!.link({
                        id: ent.index,
                        origin: ent.origin,
                        mins: ent.mins,
                        maxs: ent.maxs,
                        contents: ent.solid === 0 ? 0 : 1,
                        surfaceFlags: 0
                    });
                }
            });
            this.backup.clear();
        }
    }
}

export function createServer(options: ServerOptions = {}): DedicatedServer {
    return new DedicatedServer(options);
}
