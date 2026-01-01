import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLoadTracker, ResourceType } from '../../../src/assets/resourceTracker';

describe('ResourceLoadTracker', () => {
  let tracker: ResourceLoadTracker;

  beforeEach(() => {
    tracker = new ResourceLoadTracker();
  });

  it('should not record loads when not tracking', () => {
    tracker.recordLoad(ResourceType.Texture, 'test.png');
    const log = tracker.stopTracking();
    expect(log.uniqueResources.size).toBe(0);
  });

  it('should record loads when tracking', () => {
    tracker.startTracking();
    tracker.setCurrentFrame(10);
    tracker.setCurrentTime(1.0);

    tracker.recordLoad(ResourceType.Texture, 'test.png', 1024, 'pak0.pak');

    const log = tracker.stopTracking();
    expect(log.uniqueResources.size).toBe(1);

    const entry = log.uniqueResources.get('texture:test.png');
    expect(entry).toBeDefined();
    expect(entry?.frame).toBe(10);
    expect(entry?.timestamp).toBe(1.0);
    expect(entry?.size).toBe(1024);
    expect(entry?.pakSource).toBe('pak0.pak');

    expect(log.byFrame.get(10)?.length).toBe(1);
    expect(log.byTime.get(1.0)?.length).toBe(1);
  });

  it('should record multiple entries', () => {
    tracker.startTracking();

    tracker.setCurrentFrame(1);
    tracker.recordLoad(ResourceType.Texture, 't1.png');

    tracker.setCurrentFrame(2);
    tracker.recordLoad(ResourceType.Sound, 's1.wav');

    const log = tracker.stopTracking();
    expect(log.uniqueResources.size).toBe(2);
    expect(log.byFrame.get(1)?.length).toBe(1);
    expect(log.byFrame.get(2)?.length).toBe(1);
  });

  it('should handle duplicate loads', () => {
    tracker.startTracking();

    tracker.recordLoad(ResourceType.Texture, 'test.png');
    tracker.recordLoad(ResourceType.Texture, 'test.png');

    const log = tracker.stopTracking();

    // It should record both accesses in the entries list (so duplicate entries in array logic?)
    // But uniqueResources map should key by type+path.

    expect(log.uniqueResources.size).toBe(1);

    // However, byFrame should contain both?
    // Let's check implementation. stopTracking iterates entries.
    // byFrame.get(0).push(entry)

    expect(log.byFrame.get(0)?.length).toBe(2);
  });
});
