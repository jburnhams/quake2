import { WebSocketServer } from 'ws';
import { WebSocketNetDriver } from './net/nodeWsDriver.js';
import { createGame, GameExports, GameImports, GameEngine, Entity, MulticastType, GameStateSnapshot, Solid } from '@quake2ts/game';
import { Client, createClient, ClientState } from './client.js';
import { ClientMessageParser } from './protocol.js';
import { BinaryWriter, ServerCommand, BinaryStream, UserCommand, traceBox, CollisionModel, UPDATE_BACKUP, MAX_CONFIGSTRINGS, MAX_EDICTS, EntityState, CollisionEntityIndex, inPVS, inPHS, crc8 } from '@quake2ts/shared';
import { parseBsp } from '@quake2ts/engine';
import fs from 'node:fs/promises';
import { createPlayerInventory, createPlayerWeaponStates } from '@quake2ts/game';
import { Server, ServerState, ServerStatic } from './server.js';
import { writeDeltaEntity, writeRemoveEntity } from './protocol/entity.js';
import { writePlayerState, ProtocolPlayerState } from './protocol/player.js';
import { writeServerCommand } from './protocol/write.js';

const MAX_CLIENTS = 16;
const FRAME_RATE = 10; // 10Hz dedicated server loop (Q2 standard)
const FRAME_TIME_MS = 1000 / FRAME_RATE;

export class DedicatedServer implements GameEngine {
    private wss: WebSocketServer | null = null;
    private svs: ServerStatic;
    private sv: Server;
    private game: GameExports | null = null;
    private frameTimeout: NodeJS.Timeout | null = null;
    private entityIndex: CollisionEntityIndex | null = null;

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
        this.entityIndex = new CollisionEntityIndex();
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
                // Check against entity spatial index if available.
                // CollisionEntityIndex.trace will internally perform the world trace if the model is provided,
                // merging results to return the closest hit.
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

                    // Resolve entity ID to Entity object
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

                // Fallback: world trace only (e.g. if entity index is not initialized)
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
            pointcontents: (p) => 0, // Empty
            linkentity: (ent) => {
                if (!this.entityIndex) return;
                // Update entity in the spatial index
                this.entityIndex.link({
                    id: ent.index,
                    origin: ent.origin,
                    mins: ent.mins,
                    maxs: ent.maxs,
                    contents: ent.solid === 0 ? 0 : 1, // Simplified contents
                    surfaceFlags: 0
                });
            },
            areaEdicts: (mins, maxs) => {
                 if (!this.entityIndex) return [];
                 // Use gatherTriggerTouches as a generic box query for now
                 // or implement areaEdicts in CollisionEntityIndex specifically for general query
                 // gatherTriggerTouches filters by contents mask, so pass -1 or similar if needed?
                 // But wait, gatherTriggerTouches accepts mask.
                 // If we want all entities, we might need to adjust CollisionEntityIndex or use a generic mask.
                 // Assuming 0xFFFFFFFF for all.
                 return this.entityIndex.gatherTriggerTouches({ x: 0, y: 0, z: 0 }, mins, maxs, 0xFFFFFFFF);
            },
            multicast: (origin, type, event, ...args) => this.multicast(origin, type, event, ...args),
            unicast: (ent, reliable, event, ...args) => this.unicast(ent, reliable, event, ...args),
            configstring: (index, value) => this.SV_SetConfigString(index, value)
        };

        this.game = createGame(imports, this, {
            gravity: { x: 0, y: 0, z: -800 },
            deathmatch: true
        });

        this.game.init(0);
        this.game.spawnWorld();

        // Populate baselines after world spawn
        this.populateBaselines();

        this.sv.state = ServerState.Game;

        // 4. Start Loop
        this.runFrame();
        console.log('Server started.');
    }

    private populateBaselines() {
        if (!this.game) return;

        this.game.entities.forEachEntity((ent) => {
            if (ent.index >= MAX_EDICTS) return;
            // Create baseline state
            // Only for entities with model or solid
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
            sound: ent.sounds, // Assuming ent.sounds maps to 'sound' field in EntityState
            event: 0
        };
    }

    public stop() {
        if (this.frameTimeout) clearTimeout(this.frameTimeout);
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
        // Initialize lastMessage to current frame to prevent immediate timeout
        client.lastMessage = this.sv.frame;
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
        if (client.edict && this.game) {
            this.game.clientDisconnect(client.edict);
        }
        this.svs.clients[client.index] = null;
        if (this.entityIndex && client.edict) {
            this.entityIndex.unlink(client.edict.index);
        }
    }

    private dropClient(client: Client) {
        // Disconnect handling will be triggered by onClose callback from net driver
        if (client.net) {
             client.net.disconnect();
        }
    }

    private handleMove(client: Client, cmd: UserCommand, checksum: number, lastFrame: number) {
        // Verify Checksum
        if (lastFrame > 0 && lastFrame <= client.lastFrame && lastFrame > client.lastFrame - UPDATE_BACKUP) {
             const frameIdx = lastFrame % UPDATE_BACKUP;
             const frame = client.frames[frameIdx];

             // Verify
             if (frame.packetCRC !== checksum) {
                 console.warn(`Client ${client.index} checksum mismatch for frame ${lastFrame}: expected ${frame.packetCRC}, got ${checksum}`);
                 // Q2 behavior: usually ignore or drop. We log for now.
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
        if (cmd.startsWith('connect ')) {
            const userInfo = cmd.substring(8); // "connect ".length
            this.handleConnect(client, userInfo);
        } else if (cmd === 'begin') {
            this.handleBegin(client);
        }
    }

    private handleConnect(client: Client, userInfo: string) {
        if (!this.game) return;

        // client.edict is likely null here, but we pass it to match Q2 signature
        const result = this.game.clientConnect(client.edict || null, userInfo);
        if (result === true) {
            client.state = ClientState.Connected;
            client.userInfo = userInfo;
            console.log(`Client ${client.index} connected: ${userInfo}`);
            this.sendServerData(client);
            // Q2 sends "precache\n" via stufftext here
            const writer = new BinaryWriter();
            writer.writeByte(ServerCommand.stufftext);
            writer.writeString("precache\n");
            client.net.send(writer.getData());
        } else {
            console.log(`Client ${client.index} rejected: ${result}`);
            // Send rejection message?
            const writer = new BinaryWriter();
            writer.writeByte(ServerCommand.print);
            writer.writeByte(2); // PRINT_HIGH
            writer.writeString(`Connection rejected: ${result}\n`);
            client.net.send(writer.getData());
            // TODO: Disconnect client after delay?
        }
    }

    private handleBegin(client: Client) {
        if (client.state === ClientState.Connected) {
            this.spawnClient(client);
        }
    }

    private spawnClient(client: Client) {
        if (!this.game) return;

        // Use Game Exports to spawn player properly
        const ent = this.game.clientBegin({
            inventory: createPlayerInventory(),
            weaponStates: createPlayerWeaponStates(),
            buttons: 0,
            pm_type: 0,
            pm_time: 0,
            pm_flags: 0,
            gun_frame: 0,
            rdflags: 0,
            fov: 90
        });

        client.edict = ent;
        client.state = ClientState.Active;

        // In Q2, we don't resend serverdata on begin, but we might ensure client knows it's active.
        // The game logic will now include this entity in snapshots.
        console.log(`Client ${client.index} entered game`);
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

       // Send all configstrings
       for (let i = 0; i < MAX_CONFIGSTRINGS; i++) {
           if (this.sv.configStrings[i]) {
               this.SV_WriteConfigString(writer, i, this.sv.configStrings[i]);
           }
       }

       // Send baselines
       for (let i = 0; i < MAX_EDICTS; i++) {
           if (this.sv.baselines[i]) {
               writer.writeByte(ServerCommand.spawnbaseline);
               writeDeltaEntity({} as EntityState, this.sv.baselines[i]!, writer, true, true);
           }
       }

       client.net.send(writer.getData());
    }

    private SV_SetConfigString(index: number, value: string) {
        if (index < 0 || index >= MAX_CONFIGSTRINGS) return;

        // Update server state
        this.sv.configStrings[index] = value;

        // Broadcast to all active clients
        for (const client of this.svs.clients) {
            if (client && client.state >= ClientState.Connected) {
                // Config strings are always reliable
                if (client.netchan) {
                    try {
                        client.netchan.writeReliableByte(ServerCommand.configstring);
                        client.netchan.writeReliableShort(index);
                        client.netchan.writeReliableString(value);

                        // Force transmit immediately for config strings
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

                // Process through NetChan
                const data = client.netchan.process(rawData);
                if (!data) {
                    // Duplicate or out of order, or invalid qport
                    continue;
                }

                if (data.length === 0) {
                    // Just an ack or keepalive
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

        const startTime = Date.now();

        this.sv.frame++;
        this.sv.time += 100; // 100ms per frame

        // 1. Read network packets
        this.SV_ReadPackets();

        // 2. Run client commands
        for (const client of this.svs.clients) {
            if (!client || client.state === ClientState.Free) continue;

            // Check timeout
            // Timeout if no packet received for 30 seconds (assuming 10Hz = 300 frames)
            if (client.state >= ClientState.Connected) {
                 const timeoutFrames = 300; // 30 seconds * 10 Hz
                 if (this.sv.frame - client.lastMessage > timeoutFrames) {
                     console.log(`Client ${client.index} timed out`);
                     this.dropClient(client);
                     continue;
                 }
            }

            if (client && client.state === ClientState.Active && client.edict) {
                // Rate limiting
                const now = Date.now();
                if (now - client.lastCommandTime >= 1000) {
                    client.lastCommandTime = now;
                    client.commandCount = 0;
                }

                if (client.commandCount > 200) {
                     console.warn(`Client ${client.index} kicked for command flooding`);
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

        // 4. Send Updates
        if (snapshot && snapshot.state) {
            this.SV_SendClientMessages(snapshot.state);
        }

        // Calculate sleep time
        const endTime = Date.now();
        const elapsed = endTime - startTime;
        const sleepTime = Math.max(0, FRAME_TIME_MS - elapsed);

        // Schedule next frame
        if (this.sv.state === ServerState.Game) {
            this.frameTimeout = setTimeout(() => this.runFrame(), sleepTime);
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
        // Use a buffer starting at 1400 bytes.
        // We manually enforce MTU by checking writer.getOffset() before adding entities.
        const MTU = 1400;
        const writer = new BinaryWriter(MTU);
        writer.writeByte(ServerCommand.frame);
        writer.writeLong(this.sv.frame);

        // Calculate delta frame
        // If client.lastFrame is valid and recent, we use it for delta compression
        let deltaFrame = 0;
        if (client.lastFrame && client.lastFrame < this.sv.frame && client.lastFrame >= this.sv.frame - UPDATE_BACKUP) {
            deltaFrame = client.lastFrame;
        }

        writer.writeLong(deltaFrame); // Delta frame
        writer.writeByte(0); // Suppress
        writer.writeByte(0); // Area bytes

        // Player info
        writer.writeByte(ServerCommand.playerinfo);

        // Map GameStateSnapshot to ProtocolPlayerState
        const ps: ProtocolPlayerState = {
            pm_type: snapshot.pmType,
            origin: snapshot.origin,
            velocity: snapshot.velocity,
            pm_time: snapshot.pm_time,
            pm_flags: snapshot.pmFlags,
            gravity: Math.abs(snapshot.gravity.z), // Usually only Z is relevant for gravity value
            delta_angles: snapshot.deltaAngles,
            viewoffset: { x: 0, y: 0, z: 22 }, // Default view offset if not in snapshot
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

        // Packet entities
        writer.writeByte(ServerCommand.packetentities);

        const entities = snapshot.packetEntities || [];
        const currentEntityIds: number[] = [];

        // Store current frame entities in client history
        const frameIdx = this.sv.frame % UPDATE_BACKUP;
        const currentFrame = client.frames[frameIdx];
        // FIX: entities is already EntityState[], so we don't need to convert them
        currentFrame.entities = entities;

        // Get old frame entities if delta compression is active
        let oldEntities: EntityState[] = [];
        if (deltaFrame > 0) {
            const oldFrameIdx = deltaFrame % UPDATE_BACKUP;
            oldEntities = client.frames[oldFrameIdx].entities;
        }

        // 1. Write current frame entities
        for (const entityState of currentFrame.entities) {
            // Check for overflow before writing
            // A conservative estimate for a delta entity is ~32 bytes
            // We need to leave room for removals and footer (0 short)
            if (writer.getOffset() > MTU - 200) {
                console.warn('Packet MTU limit reached, dropping remaining entities');
                break;
            }

            currentEntityIds.push(entityState.number);

            // Try to find old entity state
            const oldState = oldEntities.find(e => e.number === entityState.number);

            if (oldState) {
                 writeDeltaEntity(oldState, entityState, writer, false, false);
            } else {
                 writeDeltaEntity({} as EntityState, entityState, writer, false, true);
            }
        }

        // 2. Identify and write removals
        // Check entities that were in last packet but are NOT in this packet
        for (const oldId of client.lastPacketEntities) {
            // Check for overflow
            if (writer.getOffset() > MTU - 10) {
                console.warn('Packet MTU limit reached, dropping remaining removals');
                break;
            }

            if (!currentEntityIds.includes(oldId)) {
                writeRemoveEntity(oldId, writer);
            }
        }

        // Write 0 to signal end of entities
        writer.writeShort(0);

        // Calculate CRC of the unreliable payload (writer data)
        const frameData = writer.getData();
        currentFrame.packetCRC = crc8(frameData);

        // Send via NetChan
        const packet = client.netchan.transmit(frameData);
        client.net.send(packet);

        // Update client history
        client.lastFrame = this.sv.frame;
        client.lastPacketEntities = currentEntityIds;
    }

    // GameEngine Implementation
    trace(start: any, end: any): any {
        return { fraction: 1.0 };
    }

    multicast(origin: any, type: MulticastType, event: ServerCommand, ...args: any[]): void {
        const writer = new BinaryWriter();

        // Write the command
        writeServerCommand(writer, event, ...args);

        const data = writer.getData();
        const reliable = event === ServerCommand.print || event === ServerCommand.configstring; // Basic heuristic

        for (const client of this.svs.clients) {
            if (!client || client.state < ClientState.Active || !client.edict) {
                continue;
            }

            // Filter based on MulticastType
            let send = false;
            switch (type) {
                case MulticastType.All:
                    send = true;
                    break;
                case MulticastType.Pvs:
                    if (this.sv.collisionModel) {
                        send = inPVS(origin, client.edict.origin, this.sv.collisionModel);
                    } else {
                        send = true; // Fallback
                    }
                    break;
                case MulticastType.Phs:
                    if (this.sv.collisionModel) {
                        send = inPHS(origin, client.edict.origin, this.sv.collisionModel);
                    } else {
                        send = true; // Fallback
                    }
                    break;
            }

            if (send) {
                // TODO: Differentiate between reliable and unreliable stream
                // For now, simple send
                client.net.send(data);
            }
        }
    }

    unicast(ent: Entity, reliable: boolean, event: ServerCommand, ...args: any[]): void {
        // Find client for ent
        const client = this.svs.clients.find(c => c?.edict === ent);
        if (client && client.state >= ClientState.Connected) {
            const writer = new BinaryWriter();
            writeServerCommand(writer, event, ...args);
            client.net.send(writer.getData());
        }
    }

    configstring(index: number, value: string): void {
        this.SV_SetConfigString(index, value);
    }
}
