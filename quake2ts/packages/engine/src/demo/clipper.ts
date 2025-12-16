import { DemoReader } from './demoReader.js';
import { EntityState, ProtocolPlayerState, createEmptyEntityState, createEmptyProtocolPlayerState } from './parser.js';
import { NetworkMessageParser, NetworkMessageHandler, FrameData } from './parser.js';
import { U_REMOVE } from './parser.js';
import { applyEntityDelta } from './delta.js';

export interface ServerDataMessage {
  protocolVersion: number;
  serverCount: number;
  attractLoop: boolean;
  gameDirectory: string;
  levelName: string;
}

export interface WorldState {
  serverData: ServerDataMessage | null;
  configStrings: Map<number, string>;
  entityBaselines: Map<number, EntityState>;
  playerState: ProtocolPlayerState;
  entities: Map<number, EntityState>;
  gameTime: number; // For frame number/time reference
}

export class DemoClipper {

  static extractClip(demoData: ArrayBuffer, startFrame: number, endFrame: number): Uint8Array {
      const reader = new DemoReader(demoData);

      // Calculate start and end offsets
      if (!reader.seekToMessage(startFrame)) {
          throw new Error(`Start frame ${startFrame} out of bounds`);
      }
      const startOffset = reader.getOffset();

      // If endFrame is beyond count, read to end
      let endOffset = demoData.byteLength;
      if (endFrame < reader.getMessageCount()) {
           if (reader.seekToMessage(endFrame)) {
               endOffset = reader.getOffset();
           }
      }

      // Extract bytes
      const length = endOffset - startOffset;
      const result = new Uint8Array(length + 4); // +4 for terminator if needed?
      // Demos usually end with a specific message or just EOF.
      // Standard demo format is just a sequence of messages.
      // We should probably preserve the sequence.

      const sourceView = new Uint8Array(demoData);
      result.set(sourceView.subarray(startOffset, endOffset), 0);

      // Add terminator -1 length block?
      // Q2 demo format: block length (4 bytes) + block data.
      // Terminator is length -1.
      const view = new DataView(result.buffer);
      view.setInt32(length, -1, true);

      return result;
  }

  static async captureWorldState(demoData: ArrayBuffer, atFrame: number): Promise<WorldState> {
      const reader = new DemoReader(demoData);
      const configStrings = new Map<number, string>();
      const entityBaselines = new Map<number, EntityState>();
      let serverData: ServerDataMessage | null = null;
      let playerState = createEmptyProtocolPlayerState();
      const entities = new Map<number, EntityState>();

      // We need to replay from start to atFrame to build state
      let currentFrame = -1;

      const handler: NetworkMessageHandler = {
          onServerData: (data) => {
              serverData = {
                  protocolVersion: data.protocolVersion,
                  serverCount: data.serverCount,
                  attractLoop: data.attractLoop,
                  gameDirectory: data.gameDirectory,
                  levelName: data.levelName
              };
          },
          onConfigString: (index, str) => {
              configStrings.set(index, str);
          },
          onSpawnBaseline: (entity) => {
              entityBaselines.set(entity.number, entity);
          },
          onFrame: (frameData) => {
              playerState = frameData.playerState;

              const packetEntities = frameData.packetEntities;

              // Delta compression logic (similar to ClientNetworkHandler)
              // If not delta, we clear entities (except maybe those persisting? No, non-delta means full snapshot)
              // Actually in Q2 non-delta frame implies full replacement.
              if (!packetEntities.delta) {
                  entities.clear();
              }

              for (const partial of packetEntities.entities) {
                  if (partial.bits & U_REMOVE) {
                      entities.delete(partial.number);
                      continue;
                  }

                  const number = partial.number;
                  let source: EntityState | undefined;

                  if (packetEntities.delta && entities.has(number)) {
                      source = entities.get(number);
                  } else if (entityBaselines.has(number)) {
                      source = entityBaselines.get(number);
                  } else {
                      source = createEmptyEntityState();
                  }

                  const final = structuredClone(source!);
                  applyEntityDelta(final, partial);
                  entities.set(number, final);
              }
          },
          onCenterPrint: () => {},
          onStuffText: () => {},
          onSound: () => {},
          onPrint: () => {},
          onMuzzleFlash: () => {},
          onMuzzleFlash2: () => {},
          onTempEntity: () => {},
          onLayout: () => {},
          onInventory: () => {},
          onDisconnect: () => {},
          onReconnect: () => {},
          onDownload: () => {}
      };

      while (reader.hasMore()) {
          // If we reached target frame, break AFTER processing?
          // Task says "atOffset". We should process up to that frame inclusive or just before?
          // "Play demo from start to offset, accumulate all state"
          // If we want state AT frame X, we need to process frame X.

          // DemoReader is message based. Frames are messages.
          // currentFrame is index.

          // Peek next block or read it?
          // We iterate blocks.

          if (currentFrame >= atFrame) {
              break;
          }

          const block = reader.readNextBlock();
          if (!block) break;

          currentFrame++;

          const parser = new NetworkMessageParser(block.data, handler);
          parser.setProtocolVersion(serverData?.protocolVersion ?? 34);
          parser.parseMessage();
      }

      return {
          serverData,
          configStrings,
          entityBaselines,
          playerState,
          entities,
          gameTime: 0
      };
  }

  static extractStandaloneClip(demoData: ArrayBuffer, startFrame: number, endFrame: number, worldState: WorldState): Uint8Array {
      // 1. Create a synthetic header / start block
      // containing ServerData, ConfigStrings, Baselines, and initial EntityState (as a full update frame)

      // This is complex. We need to serialize messages.
      // Task says "Re-serialize to valid demo format"
      // We don't have a message WRITER yet (BinaryWriter exists in shared, but we need Protocol Message Writer).

      // For now, let's just return the raw clip bytes, assuming the consumer will prepend state?
      // No, "extractStandaloneClip" implies it should be playable.

      // Writing protocol messages is not implemented in engine yet.
      // We have `BinaryWriter` in shared.
      // We need `NetworkMessageWriter`.

      throw new Error("extractStandaloneClip not fully implemented: requires NetworkMessageWriter");
  }
}
