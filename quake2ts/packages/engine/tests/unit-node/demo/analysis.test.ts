import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DemoPlaybackController } from '@quake2ts/engine/demo/playback.js';
import { NetworkMessageHandler, createEmptyProtocolPlayerState, createEmptyEntityState } from '@quake2ts/engine/demo/parser.js';

describe('DemoPlaybackController Analysis', () => {
  let controller: DemoPlaybackController;
  let mockHandler: NetworkMessageHandler;
  let entitiesMap: Map<number, any>;
  let playerState: any;

  beforeEach(() => {
    entitiesMap = new Map();
    playerState = createEmptyProtocolPlayerState();

    controller = new DemoPlaybackController();
    mockHandler = {
      onServerData: vi.fn(),
      onBaseline: vi.fn(),
      onFrame: vi.fn(),
      onPrint: vi.fn(),
      onCenterPrint: vi.fn(),
      onStuffText: vi.fn(),
      onSound: vi.fn(),
      onTempEntity: vi.fn(),
      onLayout: vi.fn(),
      onInventory: vi.fn(),
      onConfigString: vi.fn(),
      onMuzzleFlash: vi.fn(),
      onSpawnBaseline: vi.fn(),
      getEntities: vi.fn().mockReturnValue(entitiesMap),
      getPlayerState: vi.fn().mockReturnValue(playerState)
    };
    controller.setHandler(mockHandler);

    // Create mock buffer
    const buffer = new ArrayBuffer(10 * 5); // 10 frames
    const view = new DataView(buffer);
    for (let i = 0; i < 10; i++) {
        view.setInt32(i * 5, 1, true); // Length 1
        view.setUint8(i * 5 + 4, 6); // NOP
    }
    controller.loadDemo(buffer);
  });

  it('should compare frames correctly', () => {
    // Setup state for frame 1
    const ent1 = createEmptyEntityState();
    ent1.number = 1;
    ent1.origin = { x: 10, y: 0, z: 0 };

    // We mock the handler implementation to change state based on calls
    // But since `compareFrames` calls `getFrameEntities` which seeks,
    // we need `mockHandler.getEntities` to return different things based on when it is called.
    // This is hard to mock purely with static returns.

    // Instead, we can intercept onFrame in the handler and update the map?
    // But `processNextFrame` updates the handler.

    // Let's mock `getFrameEntities` on the controller directly for this test?
    // No, we want to test `compareFrames` logic.

    // Let's spy on `getFrameEntities` and `getFramePlayerState` of the controller.
    const getFrameEntitiesSpy = vi.spyOn(controller, 'getFrameEntities');
    const getFramePlayerStateSpy = vi.spyOn(controller, 'getFramePlayerState');

    // Mock return values
    const stateA = createEmptyProtocolPlayerState();
    stateA.origin = { x: 0, y: 0, z: 0 };
    stateA.stats[1] = 100; // Health

    const stateB = createEmptyProtocolPlayerState();
    stateB.origin = { x: 10, y: 0, z: 0 };
    stateB.stats[1] = 90; // Damaged

    const entA = createEmptyEntityState();
    entA.number = 1;
    entA.origin = { x: 0, y: 0, z: 0 };

    const entB = createEmptyEntityState();
    entB.number = 1;
    entB.origin = { x: 0, y: 0, z: 10 };

    const entNew = createEmptyEntityState();
    entNew.number = 2;

    getFramePlayerStateSpy.mockImplementation((frame) => frame === 1 ? stateA : stateB);
    getFrameEntitiesSpy.mockImplementation((frame) => {
        if (frame === 1) return [entA];
        return [entB, entNew];
    });

    const diff = controller.compareFrames(1, 2);

    expect(diff.playerStateDiff.health).toBe(-10);
    expect(diff.playerStateDiff.origin).toEqual({ x: 10, y: 0, z: 0 });

    expect(diff.entityDiffs.moved.length).toBe(1);
    expect(diff.entityDiffs.moved[0].id).toBe(1);
    expect(diff.entityDiffs.moved[0].delta).toEqual({ x: 0, y: 0, z: 10 });

    expect(diff.entityDiffs.added).toContain(2);
  });

  it('should extract entity trajectory', () => {
     // We need to support seeking in this test, so we can't fully mock getFrameEntities unless we implement the loop logic.
     // But `getEntityTrajectory` loops and calls `getCurrentFrame` and `stepForward`.

     // Let's mock `seek` and `stepForward` and `getCurrentFrame`.
     let currentFrame = 0;
     vi.spyOn(controller, 'seek').mockImplementation((f) => { currentFrame = f; });
     vi.spyOn(controller, 'stepForward').mockImplementation(() => { currentFrame++; });
     vi.spyOn(controller, 'getCurrentFrame').mockImplementation(() => currentFrame);

     // Mock `getEntities` via handler (accessed in loop)
     const ent = createEmptyEntityState();
     ent.number = 1;
     ent.origin = { x: 0, y: 0, z: 0 };
     entitiesMap.set(1, ent);

     // We need `getEntities` to change over time?
     // We can use a variable that updates on stepForward?

     // Actually, let's just use the `handler.getEntities` spy.
     // But `getEntityTrajectory` accesses `this.handler.getEntities()`.

     // We'll update `ent.origin` in stepForward mock.
     vi.spyOn(controller, 'stepForward').mockImplementation(() => {
         currentFrame++;
         ent.origin.x += 10;
     });

     const traj = controller.getEntityTrajectory(1, 0, 2);

     // Frame 0: 0,0,0
     // Frame 1: 10,0,0
     // Frame 2: 20,0,0

     expect(traj.length).toBe(3);
     expect(traj[0].x).toBe(0);
     expect(traj[1].x).toBe(10);
     expect(traj[2].x).toBe(20);
  });
});
