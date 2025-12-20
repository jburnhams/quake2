import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DedicatedServer } from '../src/dedicated';
import { Entity, Solid, createGame, GameExports } from '@quake2ts/game';
import { createMockGameExports } from '@quake2ts/test-utils';

vi.mock('@quake2ts/game', async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual as any,
        createGame: vi.fn(),
    };
});

describe('Lag Compensation', () => {
    let server: DedicatedServer;
    let target: Entity;
    let attacker: Entity;
    let entities: Entity[];
    let mockGame: GameExports;

    beforeEach(() => {
        vi.clearAllMocks();

        // Setup mock entities
        target = new Entity(1);
        target.solid = Solid.Bsp; // Needs to be solid to be tracked
        target.takedamage = true;
        target.origin = { x: 100, y: 0, z: 0 };
        target.mins = { x: -16, y: -16, z: -24 };
        target.maxs = { x: 16, y: 16, z: 32 };
        target.angles = { x: 0, y: 0, z: 0 };

        attacker = new Entity(2);
        attacker.origin = { x: 0, y: 0, z: 0 };

        entities = [target, attacker];

        const defaultGame = createMockGameExports();
        mockGame = createMockGameExports({
             entities: {
                 ...defaultGame.entities,
                 forEachEntity: vi.fn((cb: any) => entities.forEach(cb)),
                 getByIndex: vi.fn((id: number) => entities.find(e => e.index === id)) as any,
                 trace: vi.fn(),
             } as any
        });

        (createGame as vi.Mock).mockReturnValue(mockGame);

        server = new DedicatedServer(0);

        // Initialize server (starts game)
        // start() is async and does file io.
        // We manually inject the game instance to bypass start()
        (server as any).game = mockGame;
        (server as any).entityIndex = {
             link: vi.fn(),
             unlink: vi.fn(),
             trace: vi.fn(),
             gatherTriggerTouches: vi.fn()
        };
    });

    it('should record entity history', () => {
        // Record at time 1000
        vi.setSystemTime(1000);
        (server as any).recordHistory();

        // Check history
        const history = (server as any).history.get(target.index);
        expect(history).toBeDefined();
        expect(history).toHaveLength(1);
        expect(history![0].time).toBe(1000);
        expect(history![0].origin).toEqual({ x: 100, y: 0, z: 0 });

        // Move entity
        target.origin = { x: 200, y: 0, z: 0 };

        // Record at time 1100
        vi.setSystemTime(1100);
        (server as any).recordHistory();

        expect(history).toHaveLength(2);
        expect(history![1].time).toBe(1100);
        expect(history![1].origin).toEqual({ x: 200, y: 0, z: 0 });
    });

    it('should interpolate entity position based on lag', () => {
        // Setup history
        // Time 1000: x=100
        // Time 1100: x=200
        target.origin = { x: 100, y: 0, z: 0 };
        vi.setSystemTime(1000);
        (server as any).recordHistory();

        target.origin = { x: 200, y: 0, z: 0 };
        vi.setSystemTime(1100);
        (server as any).recordHistory();

        // Current time is 1100. Target is at 200.
        // Attacker has 50ms lag. Target should be rewound to time 1050.
        // 1050 is halfway between 1000 and 1100.
        // Origin should be 150.

        server.setLagCompensation(true, attacker, 50);

        expect(target.origin.x).toBeCloseTo(150);

        // Restore
        server.setLagCompensation(false);
        expect(target.origin.x).toBe(200);
    });

    it('should handle lag larger than history', () => {
        target.origin = { x: 100, y: 0, z: 0 };
        vi.setSystemTime(1000);
        (server as any).recordHistory();

        target.origin = { x: 200, y: 0, z: 0 };
        vi.setSystemTime(1100);
        (server as any).recordHistory();

        // Lag 200ms -> Time 900.
        // Oldest sample is 1000. Should clamp to 1000 (x=100).
        server.setLagCompensation(true, attacker, 200);

        expect(target.origin.x).toBe(100);

        server.setLagCompensation(false);
    });

    it('should handle negative lag (extrapolation not supported, clamps to newest)', () => {
        target.origin = { x: 100, y: 0, z: 0 };
        vi.setSystemTime(1000);
        (server as any).recordHistory();

        target.origin = { x: 200, y: 0, z: 0 };
        vi.setSystemTime(1100);
        (server as any).recordHistory();

        // Lag -100ms (impossible ping) -> Time 1200.
        // Newest is 1100. Should clamp to 1100 (x=200).
        server.setLagCompensation(true, attacker, -100);

        expect(target.origin.x).toBe(200);

        server.setLagCompensation(false);
    });
});
