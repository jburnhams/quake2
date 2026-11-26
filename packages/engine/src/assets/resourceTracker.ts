export enum ResourceType {
  Texture = 'texture',
  Sound = 'sound',
  Model = 'model',
  Map = 'map',
  Sprite = 'sprite',
  ConfigString = 'configString'
}

export interface ResourceLoadEntry {
  type: ResourceType;
  path: string;
  timestamp: number;
  frame: number;
  size?: number;
  pakSource?: string;
}

export interface ResourceLoadLog {
  byFrame: Map<number, ResourceLoadEntry[]>;
  byTime: Map<number, ResourceLoadEntry[]>;
  uniqueResources: Map<string, ResourceLoadEntry>;
}

export class ResourceLoadTracker {
  private tracking = false;
  private entries: ResourceLoadEntry[] = [];
  private currentFrame = 0;
  private currentTime = 0;

  startTracking(): void {
    this.tracking = true;
    this.entries = [];
  }

  stopTracking(): ResourceLoadLog {
    this.tracking = false;

    const log: ResourceLoadLog = {
      byFrame: new Map(),
      byTime: new Map(),
      uniqueResources: new Map()
    };

    for (const entry of this.entries) {
      // By Frame
      if (!log.byFrame.has(entry.frame)) {
        log.byFrame.set(entry.frame, []);
      }
      log.byFrame.get(entry.frame)!.push(entry);

      // By Time
      if (!log.byTime.has(entry.timestamp)) {
        log.byTime.set(entry.timestamp, []);
      }
      log.byTime.get(entry.timestamp)!.push(entry);

      // Unique
      const key = `${entry.type}:${entry.path}`;
      if (!log.uniqueResources.has(key)) {
        log.uniqueResources.set(key, entry);
      }
    }

    return log;
  }

  recordLoad(type: ResourceType, path: string, size?: number, pakSource?: string): void {
    if (!this.tracking) return;

    this.entries.push({
      type,
      path,
      timestamp: this.currentTime,
      frame: this.currentFrame,
      size,
      pakSource
    });
  }

  setCurrentFrame(frame: number): void {
    this.currentFrame = frame;
  }

  setCurrentTime(time: number): void {
    this.currentTime = time;
  }
}
