import { BinaryWriter, EntityState, writeDeltaEntity, ServerCommand, writeRemoveEntity, writePlayerState, ProtocolPlayerState, crc8, U_REMOVE, MAX_CONFIGSTRINGS } from '@quake2ts/shared';
import { DemoWriter } from './demoWriter.js';
import { RecorderSnapshot } from './types.js';

export class DemoRecorder {
    private demoWriter: DemoWriter;
    private frameCount: number = 0;
    private firstFrame: boolean = true;
    private lastPacketEntities: number[] = [];
    private lastEntityStates: Map<number, EntityState> = new Map();
    private protocolVersion: number = 34; // Default to 34

    constructor() {
        this.demoWriter = new DemoWriter();
    }

    public getWriter(): DemoWriter {
        return this.demoWriter;
    }

    public recordServerData(
        protocolVersion: number,
        serverCount: number,
        gameDir: string,
        playerNum: number,
        mapName: string,
        configStrings: string[]
    ): void {
        this.protocolVersion = protocolVersion;
        const writer = new BinaryWriter();

        // Write svc_serverdata
        writer.writeByte(ServerCommand.serverdata);
        writer.writeLong(protocolVersion);
        writer.writeLong(serverCount);
        writer.writeByte(0); // attractloop / demo type
        writer.writeString(gameDir);
        writer.writeShort(playerNum);
        writer.writeString(mapName);

        // Write ConfigStrings
        for (let i = 0; i < configStrings.length; i++) {
            if (configStrings[i]) {
                writer.writeByte(ServerCommand.configstring);
                writer.writeShort(i);
                writer.writeString(configStrings[i]);
            }
        }

        // Write to demo block (Server Data is usually just part of the first frame block or separate?)
        // In Q2, CL_WriteDemoMessage writes whatever is in the net channel buffer.
        // So we should just append this to a block.
        // We'll treat this as a "message" that will be wrapped in a block structure by the writer if needed.
        // But DemoWriter.writeBlock expects the full block payload including sequence numbers etc. if it mimics netchan?
        // No, .dm2 format is: [block_size: 4 bytes] [block_data]
        // block_data contains server commands.

        this.demoWriter.writeBlock(writer.getData());
    }

    public recordSnapshot(snapshot: RecorderSnapshot, frameNumber: number, timeMs: number): void {
        const writer = new BinaryWriter();

        // 1. Write svc_frame
        writer.writeByte(ServerCommand.frame);
        writer.writeLong(frameNumber);
        writer.writeLong(frameNumber - 1); // delta frame (assume sequential for now)
        writer.writeByte(0); // surpressCount
        writer.writeByte(0); // areaBytes

        // 2. Write svc_playerinfo
        writer.writeByte(ServerCommand.playerinfo);

        const ps: ProtocolPlayerState = {
            pm_type: snapshot.pmType,
            origin: { ...snapshot.origin },
            velocity: { ...snapshot.velocity },
            pm_time: snapshot.pm_time,
            pm_flags: snapshot.pmFlags,
            gravity: snapshot.gravity.z, // Usually scalar
            delta_angles: { ...snapshot.deltaAngles },
            viewoffset: { x: 0, y: 0, z: 22 }, // TODO: Pass from snapshot
            viewangles: { ...snapshot.viewangles },
            kick_angles: { ...snapshot.kick_angles },
            gun_index: snapshot.gunindex,
            gun_frame: snapshot.gun_frame,
            gun_offset: { ...snapshot.gunoffset },
            gun_angles: { ...snapshot.gunangles },
            blend: snapshot.blend,
            fov: snapshot.fov,
            rdflags: snapshot.rdflags,
            stats: snapshot.stats,
            gunskin: 0,
            gunrate: 0,
            damage_blend: [0, 0, 0, 0],
            team_id: 0
        };

        writePlayerState(writer, ps);

        // 3. Write svc_packetentities
        writer.writeByte(ServerCommand.packetentities);

        const currentEntities = snapshot.packetEntities;
        const currentIds: number[] = [];

        for (const ent of currentEntities) {
            currentIds.push(ent.number);
            const oldState = this.lastEntityStates.get(ent.number);

            // Check if we need to force update (new entity or significant change?)
            // writeDeltaEntity handles diffing.
            // If oldState exists, we diff against it. If not, we diff against empty (new entity).

            if (oldState) {
                writeDeltaEntity(oldState, ent, writer, false, false);
            } else {
                writeDeltaEntity({} as EntityState, ent, writer, false, true);
            }

            // Update last state
            this.lastEntityStates.set(ent.number, ent);
        }

        // Handle removals
        for (const oldId of this.lastPacketEntities) {
            if (!currentIds.includes(oldId)) {
                writeRemoveEntity(oldId, writer);
                this.lastEntityStates.delete(oldId);
            }
        }

        writer.writeShort(0); // End of packetentities

        // Update tracking
        this.lastPacketEntities = currentIds;
        this.frameCount++;

        // Write block
        this.demoWriter.writeBlock(writer.getData());
    }
}
