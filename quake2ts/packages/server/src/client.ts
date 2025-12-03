import { NetDriver, UserCommand, PlayerState, UPDATE_BACKUP, MAX_CONFIGSTRINGS, EntityState, NetChan } from '@quake2ts/shared';
import { Entity } from '@quake2ts/game';

export enum ClientState {
    Free = 0,
    Zombie = 1,      // client has been disconnected, but don't reuse connection for a couple seconds
    Connected = 2,   // has been assigned to a client_t, but not in game yet
    Spawned = 3,      // client is fully in game
    Active = 4       // In game (added to match existing code usage)
}

export interface ClientFrame {
    areaBytes: number;
    areaBits: Uint8Array;
    playerState: PlayerState;
    numEntities: number;
    firstEntity: number; // into the circular sv_packet_entities[]
    sentTime: number;    // for ping calculations
    entities: EntityState[];
    packetCRC: number;   // CRC of the packet sending this frame
}

export interface Client {
    index: number; // Client index (0 to maxClients - 1)
    state: ClientState;
    net: NetDriver;
    netchan: NetChan; // Network channel for reliable communication
    userInfo: string;

    lastFrame: number; // for delta compression
    lastCmd: UserCommand;

    commandMsec: number; // For anti-cheat/speed control

    frameLatency: number[]; // [LATENCY_COUNTS]
    ping: number;

    messageSize: number[]; // [RATE_MESSAGES]
    rate: number;
    suppressCount: number;

    edict: Entity | null; // The player entity
    name: string;
    messageLevel: number;

    // The datagram is written to by sound calls, prints, temp ents, etc.
    datagram: Uint8Array; // This needs to be a growable buffer really

    frames: ClientFrame[]; // [UPDATE_BACKUP]

    // Download state
    download?: Uint8Array;
    downloadSize: number;
    downloadCount: number;

    lastMessage: number; // sv.framenum when packet was last received
    lastConnect: number;

    challenge: number;

    messageQueue: Uint8Array[]; // Queue for incoming packets
    lastPacketEntities: number[]; // List of entity numbers sent in the last packet

    // Rate limiting
    commandQueue: UserCommand[];
    lastCommandTime: number;
    commandCount: number;
}

export function createClient(index: number, net: NetDriver): Client {
    // Initialize frames array
    const frames: ClientFrame[] = [];
    for (let i = 0; i < UPDATE_BACKUP; i++) {
        frames.push({
            areaBytes: 0,
            areaBits: new Uint8Array(0), // Size depends on map areas
            playerState: createEmptyPlayerState(),
            numEntities: 0,
            firstEntity: 0,
            sentTime: 0,
            entities: [],
            packetCRC: 0
        });
    }

    const netchan = new NetChan();
    // Initialize qport - normally we would get this from userinfo or handshake
    netchan.setup(Math.floor(Math.random() * 65536));

    return {
        index,
        state: ClientState.Connected,
        net,
        netchan,
        userInfo: '',

        lastFrame: 0,
        lastCmd: createEmptyUserCommand(),

        commandMsec: 0,
        frameLatency: [],
        ping: 0,
        messageSize: [],
        rate: 25000, // Default rate
        suppressCount: 0,

        edict: null,
        name: `Player ${index}`,
        messageLevel: 0,

        datagram: new Uint8Array(0),

        frames,

        downloadSize: 0,
        downloadCount: 0,

        lastMessage: 0,
        lastConnect: Date.now(),
        challenge: 0,

        messageQueue: [],
        lastPacketEntities: [],

        commandQueue: [],
        lastCommandTime: 0,
        commandCount: 0
    };
}

function createEmptyUserCommand(): UserCommand {
    return {
        msec: 0,
        buttons: 0,
        angles: { x: 0, y: 0, z: 0 },
        forwardmove: 0,
        sidemove: 0,
        upmove: 0
    };
}

function createEmptyPlayerState(): PlayerState {
    return {
        origin: { x: 0, y: 0, z: 0 },
        velocity: { x: 0, y: 0, z: 0 },
        viewAngles: { x: 0, y: 0, z: 0 },
        onGround: false,
        waterLevel: 0,
        mins: { x: -16, y: -16, z: -24 },
        maxs: { x: 16, y: 16, z: 32 },
        damageAlpha: 0,
        damageIndicators: [],
        blend: [0, 0, 0, 0],
        // Stubs for new fields
        stats: [],
        kick_angles: { x: 0, y: 0, z: 0 },
        kick_origin: { x: 0, y: 0, z: 0 },
        gunoffset: { x: 0, y: 0, z: 0 },
        gunangles: { x: 0, y: 0, z: 0 },
        gunindex: 0,
        pm_type: 0,
        pm_time: 0,
        pm_flags: 0,
        gun_frame: 0,
        rdflags: 0,
        fov: 90
    };
}
