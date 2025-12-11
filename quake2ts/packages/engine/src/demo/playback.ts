import { DemoReader } from './demoReader.js';
import { NetworkMessageParser, NetworkMessageHandler, FrameData, EntityState, ProtocolPlayerState } from './parser.js';
import { FrameDiff, DemoEvent, DemoEventType, EventSummary, DemoHeader, ServerInfo, DemoStatistics, PlayerStatistics, WeaponStatistics } from './analysis.js';
import { DemoAnalyzer } from './analyzer.js';
import { Vec3 } from '@quake2ts/shared';
import { DemoCameraMode } from './camera.js';

export enum PlaybackState {
  Stopped,
  Playing,
  Paused,
  Finished
}

export interface DemoPlaybackCallbacks {
  onPlaybackStateChange?: (state: PlaybackState) => void;
  onTimeUpdate?: (time: number) => void;
  onPlaybackComplete?: () => void;
  onSeekComplete?: () => void;
  onCaptureSnapshot?: (frame: number) => any;
  onRestoreSnapshot?: (snapshot: any) => void;
  // Forwarded events
  onFrameUpdate?: (frame: FrameData) => void;
  onPlaybackError?: (error: Error) => void;
}

export class DemoPlaybackController {
  private reader: DemoReader | null = null;
  private buffer: ArrayBuffer | null = null; // Keep reference for analysis
  private state: PlaybackState = PlaybackState.Stopped;
  private playbackSpeed: number = 1.0;
  private handler?: NetworkMessageHandler;
  private callbacks?: DemoPlaybackCallbacks;

  private currentProtocolVersion: number = 0;
  private currentFrameIndex: number = -1; // -1 means no frames processed yet

  // Last parsed frame data for accessors
  private lastFrameData: FrameData | null = null;

  // Timing
  private accumulatedTime: number = 0;
  private frameDuration: number = 100; // ms (10Hz default)

  // Snapshots
  private snapshotInterval: number = 100; // frames
  private snapshots: Map<number, any> = new Map();

  // Analysis Cache
  private cachedEvents: DemoEvent[] | null = null;
  private cachedSummary: EventSummary | null = null;
  private cachedHeader: DemoHeader | null = null;
  private cachedConfigStrings: Map<number, string> | null = null;
  private cachedServerInfo: ServerInfo | null = null;
  private cachedStatistics: DemoStatistics | null = null;
  private cachedPlayerStats: Map<number, PlayerStatistics> | null = null;
  private cachedWeaponStats: Map<number, WeaponStatistics[]> | null = null;

  // Camera State
  private cameraMode: DemoCameraMode = DemoCameraMode.FirstPerson;
  private thirdPersonDistance: number = 80;
  private thirdPersonOffset: Vec3 = { x: 0, y: 0, z: 0 };

  constructor() {}

  public setHandler(handler: NetworkMessageHandler) {
      this.handler = handler;
  }

  public setCallbacks(callbacks: DemoPlaybackCallbacks) {
      this.callbacks = callbacks;
  }

  public loadDemo(buffer: ArrayBuffer) {
    this.buffer = buffer;
    this.reader = new DemoReader(buffer);
    this.transitionState(PlaybackState.Stopped);
    this.accumulatedTime = 0;
    this.currentProtocolVersion = 0;
    this.currentFrameIndex = -1;
    this.snapshots.clear();
    this.lastFrameData = null;

    // Clear cache
    this.cachedEvents = null;
    this.cachedSummary = null;
    this.cachedHeader = null;
    this.cachedConfigStrings = null;
    this.cachedServerInfo = null;
    this.cachedStatistics = null;
    this.cachedPlayerStats = null;
    this.cachedWeaponStats = null;
  }

  public play() {
    if (this.reader && this.state !== PlaybackState.Playing) {
      this.transitionState(PlaybackState.Playing);
    }
  }

  public pause() {
    if (this.state === PlaybackState.Playing) {
      this.transitionState(PlaybackState.Paused);
    }
  }

  public stop() {
    this.transitionState(PlaybackState.Stopped);
    if (this.reader) {
      this.reader.reset();
    }
    this.accumulatedTime = 0;
    this.currentProtocolVersion = 0;
    this.currentFrameIndex = -1;
    this.lastFrameData = null;
  }

  private transitionState(newState: PlaybackState) {
      if (this.state !== newState) {
          this.state = newState;
          if (this.callbacks?.onPlaybackStateChange) {
              this.callbacks.onPlaybackStateChange(newState);
          }
      }
  }

  public setFrameDuration(ms: number) {
      this.frameDuration = ms;
  }

  public setSpeed(speed: number) {
      this.playbackSpeed = Math.max(0.1, Math.min(speed, 16.0));
  }

  public getSpeed(): number {
      return this.playbackSpeed;
  }

  public update(dt: number) {
    if (this.state !== PlaybackState.Playing || !this.reader) {
      return;
    }

    this.accumulatedTime += dt * 1000 * this.playbackSpeed; // Convert to ms

    while (this.accumulatedTime >= this.frameDuration) {
        const hasMore = this.processNextFrame();
        if (!hasMore) {
            return;
        }
        this.accumulatedTime -= this.frameDuration;

        if (this.callbacks?.onTimeUpdate) {
            this.callbacks.onTimeUpdate(this.getCurrentTime());
        }
    }
  }

  public stepForward() {
    if (!this.reader) return;
    this.processNextFrame();
    if (this.callbacks?.onTimeUpdate) {
        this.callbacks.onTimeUpdate(this.getCurrentTime());
    }
  }

  public stepBackward() {
      if (!this.reader) return;

      // Seek to current - 1
      if (this.currentFrameIndex > 0) {
          this.seek(this.currentFrameIndex - 1);
      }
  }

  public seekToTime(seconds: number) {
      const frameIndex = Math.floor((seconds * 1000) / this.frameDuration);
      this.seek(frameIndex);
  }

  public seekToFrame(frameIndex: number) {
      this.seek(frameIndex);
  }

  /**
   * Seeks to a specific frame number.
   */
  public seek(frameNumber: number) {
      if (!this.reader) return;

      const total = this.getTotalFrames();
      if (frameNumber < 0) frameNumber = 0;
      if (frameNumber >= total) frameNumber = total - 1;

      // Optimization: If seeking to next frame, just process it
      if (frameNumber === this.currentFrameIndex + 1) {
          this.processNextFrame();
          if (this.callbacks?.onSeekComplete) this.callbacks.onSeekComplete();
          return;
      }

      // 1. Determine best start point
      let startIndex = -1;
      let snapshotData: any = null;

      // Check current position
      if (frameNumber > this.currentFrameIndex && this.currentFrameIndex !== -1) {
          startIndex = this.currentFrameIndex;
      }

      // Check snapshots (find closest snapshot <= frameNumber)
      if (this.callbacks?.onRestoreSnapshot) {
          // Iterate snapshots to find best match
          for (const [frame, data] of this.snapshots) {
              if (frame <= frameNumber && frame > startIndex) {
                  startIndex = frame;
                  snapshotData = data;
              }
          }
      }

      // If no better start point found, restart from 0
      if (startIndex === -1 && this.currentFrameIndex > frameNumber) {
          this.reader.reset();
          this.currentFrameIndex = -1;
          this.currentProtocolVersion = 0;
      } else if (startIndex === -1) {
          this.reader.reset();
          this.currentFrameIndex = -1;
          this.currentProtocolVersion = 0;
      }

      // Restore snapshot if we found one better than current
      if (snapshotData && this.callbacks?.onRestoreSnapshot) {
          this.callbacks.onRestoreSnapshot(snapshotData);
          if (this.reader.seekToMessage(startIndex + 1)) {
              this.currentFrameIndex = startIndex;
          } else {
               this.reader.reset();
               this.currentFrameIndex = -1;
               this.currentProtocolVersion = 0;
          }
      }

      // 2. Fast forward loop
      while (this.currentFrameIndex < frameNumber) {
          if (this.callbacks?.onCaptureSnapshot && (this.currentFrameIndex + 1) % this.snapshotInterval === 0) {
             // Capture happens in processNextFrame
          }

          if (!this.processNextFrame()) {
              break;
          }
      }

      this.accumulatedTime = 0;

      if (this.callbacks?.onSeekComplete) {
          this.callbacks.onSeekComplete();
      }

      if (this.callbacks?.onTimeUpdate) {
          this.callbacks.onTimeUpdate(this.getCurrentTime());
      }
  }

  private processNextFrame(): boolean {
      if (!this.reader || !this.reader.hasMore()) {
          this.transitionState(PlaybackState.Finished);
          if (this.callbacks?.onPlaybackComplete) {
              this.callbacks.onPlaybackComplete();
          }
          return false;
      }

      const block = this.reader.readNextBlock();
      if (!block) {
          this.transitionState(PlaybackState.Finished);
          if (this.callbacks?.onPlaybackComplete) {
              this.callbacks.onPlaybackComplete();
          }
          return false;
      }

      this.currentFrameIndex++;

      // Parsing
      try {
          // Wrap handler to capture onFrame
          const proxyHandler: NetworkMessageHandler = {
              ...this.handler!,
              onFrame: (frame: FrameData) => {
                  this.lastFrameData = frame; // Capture last frame
                  if (this.handler?.onFrame) this.handler.onFrame(frame);
                  if (this.callbacks?.onFrameUpdate) this.callbacks.onFrameUpdate(frame);
              }
          };

          const parser = new NetworkMessageParser(block.data, this.handler ? proxyHandler : undefined);
          parser.setProtocolVersion(this.currentProtocolVersion);
          parser.parseMessage();
          this.currentProtocolVersion = parser.getProtocolVersion();

          // Snapshot capture
          if (this.callbacks?.onCaptureSnapshot && this.currentFrameIndex % this.snapshotInterval === 0 && this.currentFrameIndex > 0) {
              const snapshot = this.callbacks.onCaptureSnapshot(this.currentFrameIndex);
              if (snapshot) {
                  this.snapshots.set(this.currentFrameIndex, snapshot);
              }
          }

      } catch (e) {
          console.error("Error processing demo frame", e);
          if (this.callbacks?.onPlaybackError) {
              this.callbacks.onPlaybackError(e instanceof Error ? e : new Error(String(e)));
          }
          return false;
      }

      return true;
  }

  public getState(): PlaybackState {
      return this.state;
  }

  public getCurrentTime(): number {
      if (this.currentFrameIndex < 0) return this.accumulatedTime;
      return (this.currentFrameIndex * this.frameDuration) + this.accumulatedTime;
  }

  public getFrameCount(): number {
      return this.reader ? this.reader.getMessageCount() : 0;
  }

  public getTotalFrames(): number {
      return this.getFrameCount();
  }

  public getCurrentFrame(): number {
      return this.currentFrameIndex < 0 ? 0 : this.currentFrameIndex;
  }

  public getDuration(): number {
      return (this.getFrameCount() * this.frameDuration) / 1000;
  }

  public getTotalBytes(): number {
      return this.reader ? this.reader.getProgress().total : 0;
  }

  public getProcessedBytes(): number {
      return this.reader ? this.reader.getOffset() : 0;
  }

  // 3.2.1 Frame Data Extraction

  public getFrameData(frameIndex: number): FrameData | null {
      // If requesting current frame, return cached
      if (frameIndex === this.currentFrameIndex && this.lastFrameData) {
          return this.lastFrameData;
      }

      const previousState = this.state;
      this.pause(); // Pause while seeking

      this.seek(frameIndex);

      if (previousState === PlaybackState.Playing) {
          this.play();
      }

      return this.lastFrameData;
  }

  public getFramePlayerState(frameIndex: number): ProtocolPlayerState | null {
      if (frameIndex === this.currentFrameIndex && this.handler?.getPlayerState) {
          const state = this.handler.getPlayerState();
          if (state) return state;
      }

      const frame = this.getFrameData(frameIndex);
      return frame ? frame.playerState : null;
  }

  public getFrameEntities(frameIndex: number): EntityState[] {
      if (frameIndex === this.currentFrameIndex && this.handler?.getEntities) {
          const entitiesMap = this.handler.getEntities();
          if (entitiesMap) return Array.from(entitiesMap.values());
      }

      this.seek(frameIndex);

      if (this.handler?.getEntities) {
          const entitiesMap = this.handler.getEntities();
          return entitiesMap ? Array.from(entitiesMap.values()) : [];
      }

      return [];
  }

  // 3.2.2 Frame Comparison

  public compareFrames(frameA: number, frameB: number): FrameDiff {
      const stateA = this.getFramePlayerState(frameA);
      const entitiesA = this.getFrameEntities(frameA); // This seeks to A

      // Need to capture entities map for efficient diffing
      const mapA = new Map<number, EntityState>();
      entitiesA.forEach(e => mapA.set(e.number, e));

      const stateB = this.getFramePlayerState(frameB); // This seeks to B
      const entitiesB = this.getFrameEntities(frameB);
      const mapB = new Map<number, EntityState>();
      entitiesB.forEach(e => mapB.set(e.number, e));

      const diff: FrameDiff = {
          frameA,
          frameB,
          playerStateDiff: {
              origin: null,
              viewangles: null,
              health: null,
              ammo: null
          },
          entityDiffs: {
              added: [],
              removed: [],
              moved: []
          }
      };

      if (stateA && stateB) {
          if (stateA.origin.x !== stateB.origin.x || stateA.origin.y !== stateB.origin.y || stateA.origin.z !== stateB.origin.z) {
             diff.playerStateDiff.origin = { x: stateB.origin.x - stateA.origin.x, y: stateB.origin.y - stateA.origin.y, z: stateB.origin.z - stateA.origin.z };
          }
          // Simple health/ammo diff
          if (stateA.stats[1] !== stateB.stats[1]) diff.playerStateDiff.health = stateB.stats[1] - stateA.stats[1];
          if (stateA.stats[2] !== stateB.stats[2]) diff.playerStateDiff.ammo = stateB.stats[2] - stateA.stats[2];
      }

      // Entity diffs
      for (const [id, entB] of mapB) {
          const entA = mapA.get(id);
          if (!entA) {
              diff.entityDiffs.added.push(id);
          } else {
              if (entA.origin.x !== entB.origin.x || entA.origin.y !== entB.origin.y || entA.origin.z !== entB.origin.z) {
                  diff.entityDiffs.moved.push({
                      id,
                      delta: { x: entB.origin.x - entA.origin.x, y: entB.origin.y - entA.origin.y, z: entB.origin.z - entA.origin.z }
                  });
              }
          }
      }

      for (const [id, entA] of mapA) {
          if (!mapB.has(id)) {
              diff.entityDiffs.removed.push(id);
          }
      }

      return diff;
  }

  public getEntityTrajectory(entityId: number, startFrame: number, endFrame: number): Vec3[] {
      const trajectory: Vec3[] = [];
      const originalFrame = this.getCurrentFrame();

      this.seek(startFrame);

      while (this.getCurrentFrame() <= endFrame) {
          // Check if we are done
          if (this.state === PlaybackState.Finished) break;

          let pos: Vec3 | null = null;

          if (entityId === -1) { // Player
               const ps = this.getFramePlayerState(this.getCurrentFrame());
               if (ps) pos = { ...ps.origin };
          } else {
              // Entities
              if (this.handler?.getEntities) {
                  const ent = this.handler.getEntities().get(entityId);
                  if (ent) pos = { ...ent.origin };
              }
          }

          if (pos) trajectory.push(pos);

          if (this.getCurrentFrame() === endFrame) break;

          this.stepForward();
      }

      this.seek(originalFrame); // Restore
      return trajectory;
  }

  // 3.2.3 Event Log Extraction & 3.3 Metadata

  public getDemoEvents(): DemoEvent[] {
      this.ensureAnalysis();
      return this.cachedEvents || [];
  }

  public filterEvents(type: DemoEventType, entityId?: number): DemoEvent[] {
      const events = this.getDemoEvents();
      return events.filter(e => {
          if (e.type !== type) return false;
          if (entityId !== undefined && e.entityId !== entityId) return false;
          return true;
      });
  }

  public getEventSummary(): EventSummary {
      this.ensureAnalysis();
      return this.cachedSummary || {
          totalKills: 0,
          totalDeaths: 0,
          damageDealt: 0,
          damageReceived: 0,
          weaponUsage: new Map()
      };
  }

  public getDemoHeader(): DemoHeader | null {
      this.ensureAnalysis();
      return this.cachedHeader;
  }

  public getDemoConfigStrings(): Map<number, string> {
      this.ensureAnalysis();
      return this.cachedConfigStrings || new Map();
  }

  public getDemoServerInfo(): ServerInfo {
      this.ensureAnalysis();
      return this.cachedServerInfo || {};
  }

  public getDemoStatistics(): DemoStatistics | null {
      this.ensureAnalysis();
      return this.cachedStatistics;
  }

  public getPlayerStatistics(playerIndex: number): PlayerStatistics | null {
      this.ensureAnalysis();
      return this.cachedPlayerStats?.get(playerIndex) || null;
  }

  public getWeaponStatistics(entityId: number): WeaponStatistics[] | null {
      this.ensureAnalysis();
      return this.cachedWeaponStats?.get(entityId) || null;
  }

  private ensureAnalysis() {
      if (!this.cachedEvents && this.buffer) {
          const analyzer = new DemoAnalyzer(this.buffer);
          const result = analyzer.analyze();
          this.cachedEvents = result.events;
          this.cachedSummary = result.summary;
          this.cachedHeader = result.header;
          this.cachedConfigStrings = result.configStrings;
          this.cachedServerInfo = result.serverInfo;
          this.cachedStatistics = result.statistics;
          this.cachedPlayerStats = result.playerStats;
          this.cachedWeaponStats = result.weaponStats;
      }
  }

  public setCameraMode(mode: DemoCameraMode) {
      this.cameraMode = mode;
  }

  public getCameraMode(): DemoCameraMode {
      return this.cameraMode;
  }

  public setThirdPersonDistance(distance: number) {
      this.thirdPersonDistance = distance;
  }

  public setThirdPersonOffset(offset: Vec3) {
      this.thirdPersonOffset = offset;
  }
}
