import { BinaryStream, ServerCommand, BinaryWriter } from '@quake2ts/shared';
import { DemoReader, DemoMessageBlock } from './demoReader.js';
import { NetworkMessageHandler, NetworkMessageParser, ProtocolPlayerState, EntityState, FrameData, PROTOCOL_VERSION_RERELEASE, createEmptyEntityState, createEmptyProtocolPlayerState, U_REMOVE, U_MODEL, U_MODEL2, U_MODEL3, U_MODEL4, U_FRAME8, U_FRAME16, U_SKIN8, U_SKIN16, U_EFFECTS8, U_EFFECTS16, U_RENDERFX8, U_RENDERFX16, U_ORIGIN1, U_ORIGIN2, U_ORIGIN3, U_ANGLE1, U_ANGLE2, U_ANGLE3, U_OLDORIGIN, U_SOUND, U_EVENT, U_SOLID, U_ALPHA, U_SCALE, U_INSTANCE_BITS, U_LOOP_VOLUME, U_LOOP_ATTENUATION_HIGH, U_OWNER_HIGH, U_OLD_FRAME_HIGH } from './parser.js';
import { MessageWriter } from './writer.js';
import { DemoWriter } from './demoWriter.js';
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
  currentFrameNumber?: number;
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
            currentEntities: new Map(),
            currentFrameNumber: 0
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
                state.currentFrameNumber = frame.serverFrame;

                if (!frame.packetEntities.delta) {
                    state.currentEntities.clear();
                }

                // In captureWorldState, we must reconstruct the FULL state of each entity
                // because the frame usually contains only deltas.
                // We maintain a map of current full entity states.
                
                // Create a temporary map for the new frame state
                // This mimics CL_ParsePacketEntities
                const newEntities = new Map<number, EntityState>();

                // If delta compression is used, we copy valid entities from previous frame
                if (frame.packetEntities.delta) {
                    for (const [key, val] of state.currentEntities) {
                         newEntities.set(key, val); // We'll clone only if modified, or just clone all? Clone all to be safe.
                         // Actually, we can reuse the object reference if not modified, but safer to clone.
                         // Optimization: Map stores refs.
                    }
                }

                for (const deltaEnt of frame.packetEntities.entities) {
                    if (deltaEnt.bits & U_REMOVE) {
                        newEntities.delete(deltaEnt.number);
                        continue;
                    }

                    // Find baseline or previous state
                    let prev = newEntities.get(deltaEnt.number);
                    
                    if (!prev) {
                        // If not found in current entities, check baseline
                        const baseline = state.entityBaselines.get(deltaEnt.number);
                        if (baseline) {
                            prev = { ...baseline };
                        } else {
                            prev = createEmptyEntityState();
                            prev.number = deltaEnt.number;
                        }
                    } else {
                         // We have a previous state, clone it to avoid mutating history (though we don't keep history here)
                         prev = { ...prev };
                    }

                    // Apply delta
                    applyEntityDelta(prev, deltaEnt);
                    newEntities.set(deltaEnt.number, prev);
                }

                state.currentEntities = newEntities;
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

        controller.setHandler(handler); // Using handler directly, no enhanced wrapper needed if logic is inside

        // Determine seek target
        const targetFrame = atOffset.type === 'frame' ? atOffset.frame : controller.timeToFrame(atOffset.seconds);

        // Start playback (fast forward)
        controller.seek(targetFrame);

        return state;
    }

    public extractStandaloneClip(demo: Uint8Array, start: PlaybackOffset, end: PlaybackOffset, worldState: WorldState): Uint8Array {
        const demoWriter = new DemoWriter();
        
        // Block 1: Header + Initial State
        const headerWriter = new MessageWriter();
        
        const controller = new DemoPlaybackController();
        controller.loadDemo(demo.buffer as ArrayBuffer);
        
        // Resolve frame range
        const startFrame = start.type === 'frame' ? start.frame : controller.timeToFrame(start.seconds);
        const endFrame = end.type === 'frame' ? end.frame : controller.timeToFrame(end.seconds);

        // 1. Write Headers
        const { serverData } = worldState;
        if (serverData.protocol >= 2023) {
             headerWriter.writeServerDataRerelease(
                 serverData.protocol,
                 serverData.serverCount,
                 serverData.demoType || 0,
                 serverData.tickRate || 10,
                 serverData.gameDir,
                 serverData.playerNum,
                 serverData.levelName
             );
        } else {
             headerWriter.writeServerData(
                 serverData.protocol,
                 serverData.serverCount,
                 serverData.attractLoop,
                 serverData.gameDir,
                 serverData.playerNum,
                 serverData.levelName
             );
        }

        // 2. Write ConfigStrings
        for (const [index, str] of worldState.configStrings) {
            headerWriter.writeConfigString(index, str);
        }

        // 3. Write Baselines
        for (const entity of worldState.entityBaselines.values()) {
            headerWriter.writeSpawnBaseline(entity, serverData.protocol);
        }

        // 4. Synthesize Frame 0 (Full Update)
        const entities = Array.from(worldState.currentEntities.values());
        
        const frame0: FrameData = {
            serverFrame: 0, // Rebase to 0
            deltaFrame: -1,
            surpressCount: 0,
            areaBytes: 0,
            areaBits: new Uint8Array(0), // TODO: capture area bits?
            playerState: worldState.playerState,
            packetEntities: {
                delta: false,
                entities: entities // These are full entity states, writeFrame will handle them
            }
        };
        
        headerWriter.writeFrame(frame0, serverData.protocol);
        
        // Write first block
        demoWriter.writeBlock(headerWriter.getData());
        
        // Mapping from Original Frame Number -> New Frame Number
        const frameMap = new Map<number, number>();
        frameMap.set(startFrame, 0); // Our synthetic frame corresponds to startFrame
        
        // 5. Process Subsequent Frames
        // We scan the demo starting from startFrame + 1
        const reader = new DemoReader(demo.buffer as ArrayBuffer);
        if (reader.seekToMessage(startFrame + 1)) {
            let messageIndex = startFrame + 1;
            
            while (messageIndex <= endFrame && reader.nextBlock()) {
                const block = reader.getBlock();
                const blockStream = block.data;
                
                // New writer for this block
                const blockWriter = new MessageWriter();
                
                // Let's implement a passthrough handler that intercepts Frame.
                const passthroughHandler: NetworkMessageHandler = {
                    onServerData: () => {}, 
                    onConfigString: (idx, str) => blockWriter.writeConfigString(idx, str),
                    onSpawnBaseline: (ent) => blockWriter.writeSpawnBaseline(ent, serverData.protocol),
                    onCenterPrint: (msg) => blockWriter.writeCenterPrint(msg),
                    onStuffText: (txt) => blockWriter.writeStuffText(txt),
                    onPrint: (lvl, msg) => blockWriter.writePrint(lvl, msg),
                    onSound: () => {}, // TODO: implement sound
                    onLayout: (l) => blockWriter.writeLayout(l),
                    onInventory: (inv) => blockWriter.writeInventory(inv),
                    onMuzzleFlash: (ent, w) => blockWriter.writeMuzzleFlash(ent, w),
                    onMuzzleFlash2: (ent, w) => blockWriter.writeMuzzleFlash2(ent, w),
                    
                    onFrame: (frame) => {
                         // Modify frame
                         const oldSeq = frame.serverFrame;
                         const oldDelta = frame.deltaFrame;
                         
                         const newSeq = messageIndex - startFrame; // 1, 2, 3...
                         let newDelta = -1;
                         
                         // Map delta
                         if (frameMap.has(oldDelta)) {
                             newDelta = frameMap.get(oldDelta)!;
                         } else {
                             // Fallback or full update logic
                         }
                         
                         frameMap.set(oldSeq, newSeq);
                         
                         frame.serverFrame = newSeq;
                         frame.deltaFrame = newDelta;
                         
                         blockWriter.writeFrame(frame, serverData.protocol);
                    },
                };
                
                const blockParser = new NetworkMessageParser(blockStream, passthroughHandler, false);
                blockParser.setProtocolVersion(serverData.protocol);
                blockParser.parseMessage();
                
                // Write block if it contains data
                const blockData = blockWriter.getData();
                if (blockData.byteLength > 0) {
                     demoWriter.writeBlock(blockData);
                }
                
                messageIndex++;
            }
        }
        
        // Write EOF
        demoWriter.writeEOF();
        
        return demoWriter.getData();
    }
}
