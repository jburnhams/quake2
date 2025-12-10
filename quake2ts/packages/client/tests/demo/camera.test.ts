import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientExports, ClientImports, ClientMode } from '../../src/index.js';
import { DemoCameraMode } from '../../src/demo/camera.js';
import { DemoPlaybackController, Renderer, EngineImports, EngineHost, GameRenderSample } from '@quake2ts/engine';
import { Vec3, UserCommand } from '@quake2ts/shared';

describe('Demo Camera Modes and Collision', () => {
    let client: ClientExports;
    let mockEngineImports: ClientImports['engine'];
    let mockHost: EngineHost;
    let traceMock: any;

    beforeEach(() => {
        traceMock = vi.fn().mockReturnValue({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } });

        mockEngineImports = {
            trace: traceMock,
            renderer: {
                width: 800,
                height: 600,
                renderFrame: vi.fn(),
                begin2D: vi.fn(),
                end2D: vi.fn(),
                drawPic: vi.fn(),
                stats: {}
            } as unknown as Renderer,
            assets: {
                getMap: vi.fn(),
                listFiles: vi.fn().mockReturnValue([])
            } as any
        } as unknown as EngineImports;

        mockHost = {
            cvars: {
                register: vi.fn(),
                get: vi.fn(),
                setValue: vi.fn(),
                list: vi.fn().mockReturnValue([])
            },
            commands: {
                register: vi.fn(),
                execute: vi.fn()
            }
        } as unknown as EngineHost;

        const imports: ClientImports = {
            engine: mockEngineImports,
            host: mockHost
        };

        client = createClient(imports);
    });

    it('should calculate third-person camera position correctly without collision', () => {
        // Mock demo playing
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');
        client.setDemoCameraMode(DemoCameraMode.ThirdPerson);
        client.setDemoThirdPersonDistance(100);

        // Mock getting prediction state from demoHandler
        const mockState = {
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 }, // ViewEffects needs velocity
            viewAngles: { x: 0, y: 0, z: 0 }, // Looking forward along X
            pmFlags: 0,
            frame: 1
        };

        // We need to inject this into demoHandler or mock it
        // Since we can't easily mock private demoHandler, we might rely on behavior
        // Or we can mock the getPredictionState of the demoHandler attached to client
        vi.spyOn(client.demoHandler, 'getPredictionState').mockReturnValue(mockState as any);
        vi.spyOn(client.demoHandler, 'getRenderableEntities').mockReturnValue([]);
        vi.spyOn(client.demoHandler, 'getDemoCamera').mockReturnValue({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            fov: 90
        });

        // Trigger render
        const sample: GameRenderSample<any> = {
            nowMs: 100,
            latest: { timeMs: 100, state: mockState } as any,
            previous: { timeMs: 0, state: mockState } as any,
            alpha: 1.0
        };

        client.render(sample);

        // Verify camera position was updated
        // Looking forward (X+), so camera should be at -100 X
        expect(client.lastRendered?.origin.x).toBeCloseTo(-100);
        expect(client.lastRendered?.origin.y).toBeCloseTo(0);
        expect(client.lastRendered?.origin.z).toBeCloseTo(0);
    });

    it('should adjust third-person camera position on collision', () => {
        // Mock demo playing
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');
        client.setDemoCameraMode(DemoCameraMode.ThirdPerson);
        client.setDemoThirdPersonDistance(100);

        const mockState = {
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            viewAngles: { x: 0, y: 0, z: 0 },
            pmFlags: 0,
            frame: 1
        };

        vi.spyOn(client.demoHandler, 'getPredictionState').mockReturnValue(mockState as any);
        vi.spyOn(client.demoHandler, 'getRenderableEntities').mockReturnValue([]);
        vi.spyOn(client.demoHandler, 'getDemoCamera').mockReturnValue({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            fov: 90
        });

        // Mock trace hitting a wall at 50 units
        traceMock.mockReturnValue({
            fraction: 0.5,
            endpos: { x: -50, y: 0, z: 0 }
        });

        const sample: GameRenderSample<any> = {
            nowMs: 100,
            latest: { timeMs: 100, state: mockState } as any,
            previous: { timeMs: 0, state: mockState } as any,
            alpha: 1.0
        };

        client.render(sample);

        // Verify camera position is at collision point
        expect(client.lastRendered?.origin.x).toBeCloseTo(-50);
        expect(client.lastRendered?.origin.y).toBeCloseTo(0);
        expect(client.lastRendered?.origin.z).toBeCloseTo(0);
    });
});
