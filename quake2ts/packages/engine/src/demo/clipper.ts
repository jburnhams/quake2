import { BinaryStream, ServerCommand, BinaryWriter } from '@quake2ts/shared';
import { DemoReader, DemoMessageBlock } from './demoReader.js';
import { NetworkMessageHandler, NetworkMessageParser, ProtocolPlayerState, EntityState, FrameData, PROTOCOL_VERSION_RERELEASE, createEmptyEntityState, createEmptyProtocolPlayerState, U_REMOVE, U_MODEL, U_MODEL2, U_MODEL3, U_MODEL4, U_FRAME8, U_FRAME16, U_SKIN8, U_SKIN16, U_EFFECTS8, U_EFFECTS16, U_RENDERFX8, U_RENDERFX16, U_ORIGIN1, U_ORIGIN2, U_ORIGIN3, U_ANGLE1, U_ANGLE2, U_ANGLE3, U_OLDORIGIN, U_SOUND, U_EVENT, U_SOLID, U_ALPHA, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH } from './parser.js';
import { MessageWriter } from './writer.js';
import { PlaybackOffset, DemoPlaybackController, PlaybackState } from './playback.js';
import { applyEntityDelta } from './delta.js';

export interface ServerDataMessage {
  protocol: number;
  serverCount: number; // or spawnCount for rerelease
  attractLoop: number;
  gameDir: string;
  playerNum: number;
  levelName: string;
  tickRate?: number;
  demoType?: number;
}

export interface WorldState {
  serverData: ServerDataMessage;
  configStrings: Map<number, string>;
  entityBaselines: Map<number, EntityState>;
  playerState: ProtocolPlayerState;
  // We need current entities to reconstruct the frame
  currentEntities: Map<number, EntityState>;
}

export class DemoClipper {

    /**
     * Extracts a raw clip from a demo between two offsets.
     * Simply copies the message blocks.
     */
    public extractClip(demo: Uint8Array, start: PlaybackOffset, end: PlaybackOffset, controller: DemoPlaybackController): Uint8Array {
        // We need to resolve offsets to frame indices or byte offsets
        // The easiest way is to use the controller to find the byte offsets

        // 1. Find start byte offset
        // We can use controller.timeToFrame or just assume caller provides frame/time
        // We need to find the message index corresponding to the start

        // This requires scanning the demo.
        const reader = new DemoReader(demo.buffer as ArrayBuffer);
        const startFrame = start.type === 'frame' ? start.frame : controller.timeToFrame(start.seconds);
        const endFrame = end.type === 'frame' ? end.frame : controller.timeToFrame(end.seconds);

        // Find the message offset for startFrame
        if (!reader.seekToMessage(startFrame)) {
            throw new Error(`Start frame ${startFrame} out of bounds`);
        }
        const startByteOffset = reader.getOffset();

        // Find the message offset for endFrame + 1 (exclusive)
        let endByteOffset = demo.byteLength;
        if (reader.seekToMessage(endFrame + 1)) {
            endByteOffset = reader.getOffset();
        }

        // Extract
        const clipData = demo.slice(startByteOffset, endByteOffset);

        // Append EOF (-1 length)
        const result = new Uint8Array(clipData.length + 4);
        result.set(clipData);
        const view = new DataView(result.buffer);
        view.setInt32(clipData.length, -1, true);

        return result;
    }

    public extractDemoRange(demo: Uint8Array, startFrame: number, endFrame: number): Uint8Array {
      // Create a temporary controller to handle conversions if needed, though here we have frame numbers
      // We don't have a controller instance passed in, so we assume frame numbers are absolute

      const controller = new DemoPlaybackController();
      controller.loadDemo(demo.buffer as ArrayBuffer);

      return this.extractClip(demo, { type: 'frame', frame: startFrame }, { type: 'frame', frame: endFrame }, controller);
    }

    /**
     * Captures the world state at a specific offset by playing the demo up to that point.
     */
    public async captureWorldState(demo: Uint8Array, atOffset: PlaybackOffset): Promise<WorldState> {
        const controller = new DemoPlaybackController();
        controller.loadDemo(demo.buffer as ArrayBuffer);

        // Set up state tracking
        const state: WorldState = {
            serverData: {
                protocol: 0,
                serverCount: 0,
                attractLoop: 0,
                gameDir: '',
                playerNum: 0,
                levelName: ''
            },
            configStrings: new Map(),
            entityBaselines: new Map(),
            playerState: createEmptyProtocolPlayerState(),
            currentEntities: new Map()
        };

        const handler: NetworkMessageHandler = {
            onServerData: (protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType) => {
                state.serverData = { protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType };
            },
            onConfigString: (index, str) => {
                state.configStrings.set(index, str);
            },
            onSpawnBaseline: (entity) => {
                state.entityBaselines.set(entity.number, { ...entity }); // Clone
            },
            onFrame: (frame) => {
                state.playerState = { ...frame.playerState };

                if (!frame.packetEntities.delta) {
                    state.currentEntities.clear();
                }

                for (const ent of frame.packetEntities.entities) {
                    if (ent.bits & U_REMOVE) {
                        state.currentEntities.delete(ent.number);
                    } else {
                        // Merge or replace
                        // Note: parser already merges delta if we used ClientNetworkHandler logic,
                        // but here we are using a raw parser via DemoPlaybackController which usually
                        // just emits what's in the packet.
                        // However, DemoPlaybackController's internal parser logic in `parser.ts`
                        // DOES NOT maintain state across frames for entities (it returns what's in the packet).
                        // So `ent` here is a delta or full entity.

                        // BUT: `parser.ts` `parseFrame` calls `collectPacketEntities` which parses deltas.
                        // It does NOT apply them to a baseline or previous state.
                        // So `ent` contains DELTA fields.

                        // We need to maintain the entity state ourselves to get the full state.
                        // We can use the baseline as a starting point if it's a new entity?
                        // Actually, Q2 delta compression works by XORing or diffing against old state.
                        // If we don't have the old state, we can't reconstruct the new state.

                        // DemoPlaybackController uses `NetworkMessageParser`.
                        // `NetworkMessageParser` just reads the bits.
                        // To correctly reconstruct state, we need `ClientNetworkHandler` or similar logic.

                        // HOWEVER, `DemoPlaybackController` is designed to drive the client which HAS the state.
                        // If we run `DemoPlaybackController` in headless mode (no client), we need to replicate that state tracking.

                        // Wait, `captureWorldState` should probably use `DemoPlaybackController`'s internal state?
                        // `DemoPlaybackController` doesn't seem to track full entity state in `parser.ts`.
                        // It delegates to `handler`.

                        // So we must implement a handler that tracks state.

                        let oldEnt = state.currentEntities.get(ent.number);
                        if (!oldEnt && !frame.packetEntities.delta) {
                            // If not delta frame, oldEnt is empty/baseline?
                            // Actually if `packetEntities.delta` is false, it's a full update, but entities might still be compressed against baseline?
                            // No, in Q2, non-delta frames are usually full updates.
                        }

                        // We need to apply the delta.
                        // Since `parser.ts` returns an `EntityState` struct which already contains the read fields,
                        // we need to merge it. But `parser.ts` `EntityState` initialized to empty (0).

                        // If we want to support this properly, we need the logic from `cl_parse.c` `CL_ParsePacketEntities`.

                        // Simplified approach for now:
                        // If we have a previous state for this entity, copy it, then overwrite with non-zero fields from delta?
                        // No, 0 is a valid value for some fields.

                        // The `NetworkMessageParser`'s `parseDelta` method takes `from` and `to`.
                        // In `parser.ts` `collectPacketEntities`, it passes `createEmptyEntityState()` as `from`.
                        // This means the resulting `EntityState` in `onFrame` is just the delta values.

                        // We need to re-implement the tracking logic.
                    }
                }
            },
            onCenterPrint: () => {},
            onStuffText: () => {},
            onPrint: () => {},
            onSound: () => {},
            onTempEntity: () => {},
            onLayout: () => {},
            onInventory: () => {},
            onMuzzleFlash: () => {},
            onMuzzleFlash2: () => {},
            onDisconnect: () => {},
            onReconnect: () => {},
            onDownload: () => {}
        };

        // We need to enhance the handler to perform actual delta decompression
        // This mimics ClientNetworkHandler's entity management
        const enhancedHandler: NetworkMessageHandler = {
            ...handler,
            onFrame: (frame) => {
                // Update player state
                state.playerState = frame.playerState;

                // Update entities
                // We need to know if this frame is a delta from a previous frame.
                // frame.deltaFrame is the frame number we are delta-ing from.

                // For simplified tracking (perfect state reconstruction):
                // We really should use the ClientNetworkHandler if possible, but that's in `client` package.
                // We are in `engine`.

                // Let's assume for now we can rely on `DemoPlaybackController` playing sequentially.
                // We maintain `state.currentEntities`.

                // When we receive `frame.packetEntities.entities`, they are "raw" deltas (parsed into EntityState structure with 0s where no data).
                // Wait, `parser.ts` `parseDelta` fills `to` based on flags.
                // If a flag is NOT set, the value in `to` remains what it was initialized with (which is `from`'s value).
                // In `parser.ts`: `parseDelta(createEmptyEntityState(), entity, ...)`
                // So `entity` has 0s for unset fields.

                // To reconstruct:
                // 1. Identify the baseline for each entity.
                // 2. Apply the delta.

                // BUT `parser.ts` throws away the bit flags!
                // `EntityState` has `bits` field. We can use that!

                const newEntities = new Map<number, EntityState>();

                // In a non-delta frame, start fresh (mostly)
                if (!frame.packetEntities.delta) {
                     // But we still have baselines.
                     // Packet entities in non-delta frame are delta-compressed against baseline?
                     // Q2 source: CL_ParsePacketEntities
                     // if (!delta) ... state->entities is cleared.
                } else {
                    // Copy previous state
                    for (const [key, val] of state.currentEntities) {
                        newEntities.set(key, { ...val });
                    }
                }

                for (const deltaEnt of frame.packetEntities.entities) {
                    if (deltaEnt.bits & U_REMOVE) {
                        newEntities.delete(deltaEnt.number);
                        continue;
                    }

                    // Find previous state
                    let prev = newEntities.get(deltaEnt.number);
                    if (!prev || !frame.packetEntities.delta) {
                        // If new or full update, start from baseline if available
                        const baseline = state.entityBaselines.get(deltaEnt.number);
                        if (baseline) {
                            prev = { ...baseline }; // Start with baseline
                        } else {
                            prev = createEmptyEntityState(); // Start empty
                            prev.number = deltaEnt.number;
                        }
                    }

                    // Apply delta
                    const next = { ...prev };
                    applyEntityDelta(next, deltaEnt);
                    newEntities.set(deltaEnt.number, next);
                }

                state.currentEntities = newEntities;
            }
        };

        controller.setHandler(enhancedHandler);

        // Use playWithTracking or just play() and wait?
        // We need to fast-forward to offset.
        // playFrom() does seek, which fast forwards.

        // Determine seek target
        const targetFrame = atOffset.type === 'frame' ? atOffset.frame : controller.timeToFrame(atOffset.seconds);

        // Start playback (fast forward)
        // We need to wait for it to reach the frame.
        // We can use playRange with fastForward option?

        // Wait, playRangeWithTracking expects a tracker.
        // We can just use seek(). seek() processes frames synchronously/fast.
        controller.seek(targetFrame);

        return state;
    }

    public extractStandaloneClip(demo: Uint8Array, start: PlaybackOffset, end: PlaybackOffset, worldState: WorldState): Uint8Array {
        // 1. Create a writer for the new demo
        const writer = new MessageWriter();

        // 2. Write Headers
        const { serverData } = worldState;
        if (serverData.protocol >= 2023) {
             writer.writeServerDataRerelease(
                 serverData.protocol,
                 serverData.serverCount,
                 serverData.demoType || 0,
                 serverData.tickRate || 10,
                 serverData.gameDir,
                 serverData.playerNum,
                 serverData.levelName
             );
        } else {
             writer.writeServerData(
                 serverData.protocol,
                 serverData.serverCount,
                 serverData.attractLoop,
                 serverData.gameDir,
                 serverData.playerNum,
                 serverData.levelName
             );
        }

        // 3. Write ConfigStrings
        for (const [index, str] of worldState.configStrings) {
            writer.writeConfigString(index, str);
        }

        // 4. Write Baselines
        for (const entity of worldState.entityBaselines.values()) {
            writer.writeSpawnBaseline(entity, serverData.protocol);
        }

        // 5. Write "Pre-frame" (Initial State)
        // We need to encode the current state as a full frame (delta_frame = -1)
        // This ensures the client snaps to this state immediately.

        // Construct a synthesized FrameData
        // We need to manually write the svc_frame command and its data using MessageWriter
        // But MessageWriter doesn't have writeFrame yet.

        // Implementing writeFrame is complex because we need to write playerstate and packetentities.
        // Let's defer that to a separate method or class if possible, or implement inline.

        // For now, let's assume we can copy the raw clip blocks, BUT the first block needs to be modified
        // OR we prepend a full update frame.

        // If we simply prepend a full update frame, the client will process it.
        // Then the subsequent frames from the clip (which are deltas relative to the original demo's timeline)
        // will fail because they refer to delta_frame X, but our injected frame is Y (or we reset numbering).

        // Demo playback usually ignores the sequence numbers for connection?
        // No, delta compression relies on referencing a specific past frame number.
        // If the clip starts at frame 1000, the first message says "delta from 999".
        // If we just cut the file, the client has no frame 999.

        // So `extractStandaloneClip` MUST rewrite the frame numbers and delta references.
        // This means we need to PARSE and RE-ENCODE every frame in the clip.
        // That is a heavy task ("Re-serialize to valid demo format" - indeed).

        // Re-encoding involves:
        // 1. Reading the source block.
        // 2. Parsing the message.
        // 3. Modifying svc_frame:
        //    - serverFrame: reset to 0 (or keep relative?)
        //    - deltaFrame: re-map to new sequence.
        // 4. Modifying svc_packetentities:
        //    - If it's a delta from a frame we dropped, we must convert it to a full update (or delta from our synthesized start).

        // Strategy:
        // 1. Synthesize Frame 0 (Full Update) based on WorldState.
        // 2. For subsequent frames from the clip:
        //    - Parse them.
        //    - If they are deltas, check if they refer to a frame we have included/rewritten.
        //    - If yes, update the delta_frame reference.
        //    - If no (e.g. they refer to a frame before the clip start), we must treat them as full updates or re-compress against Frame 0.
        //    - Usually, in a demo, frame N depends on N-1. So if we include Frame 0, Frame 1 (which was 1001) will depend on 1000.
        //    - We map 1000 -> 0. So 1001 -> 1, delta 0.

        // So we need a frame mapping: `oldFrameNumber -> newFrameNumber`.

        return new Uint8Array(0); // TODO: Implement full re-serializer
    }
}
