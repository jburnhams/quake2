import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient, ClientExports, ClientImports } from '@quake2ts/client/index.js';
import { DemoCameraMode } from '@quake2ts/client/demo/camera.js';
import { EngineHost, GameRenderSample, Renderer, EngineImports } from '@quake2ts/engine';
import { mat4 } from 'gl-matrix';
import { createMockDemoCameraResult, createMockLocalStorage } from '@quake2ts/test-utils';

describe('Demo Camera Modes and Collision', () => {
    let client: ClientExports;
    let mockEngineImports: ClientImports['engine'];
    let mockHost: EngineHost;
    let traceMock: any;

    beforeEach(() => {
        vi.stubGlobal('localStorage', createMockLocalStorage());

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
                setGamma: vi.fn(),
                setBrightness: vi.fn(),
                setBloom: vi.fn(),
                setBloomIntensity: vi.fn(),
                setUnderwaterWarp: vi.fn(),
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

    afterEach(() => {
        vi.unstubAllGlobals();
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

        vi.spyOn(client.demoHandler, 'getPredictionState').mockReturnValue(mockState as any);
        vi.spyOn(client.demoHandler, 'getRenderableEntities').mockReturnValue([]);

        const mockCamera = createMockDemoCameraResult({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            fov: 90
        });

        vi.spyOn(client.demoHandler, 'getDemoCamera').mockReturnValue(mockCamera);

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

        const mockCamera = createMockDemoCameraResult({
            origin: { x: 0, y: 0, z: 0 },
            angles: { x: 0, y: 0, z: 0 },
            fov: 90
        });

        vi.spyOn(client.demoHandler, 'getDemoCamera').mockReturnValue(mockCamera);

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

    it('should move free camera based on input', () => {
        client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');
        client.setDemoCameraMode(DemoCameraMode.Free);

        const startOrigin = { x: 0, y: 0, z: 0 };
        const startAngles = { x: 0, y: 0, z: 0 };
        client.setDemoFreeCamera(startOrigin, startAngles);

        const mockState = {
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            viewAngles: { x: 0, y: 0, z: 0 },
            pmFlags: 0,
            frame: 1
        };
        vi.spyOn(client.demoHandler, 'getPredictionState').mockReturnValue(mockState as any);
        vi.spyOn(client.demoHandler, 'getRenderableEntities').mockReturnValue([]);

        // Initialize time at 100
        client.render({
            nowMs: 100,
            latest: { timeMs: 100, state: mockState } as any,
            previous: { timeMs: 0, state: mockState } as any,
            alpha: 1.0
        });

        // Simulate 'w' key down
        client.handleInput('w', true);

        // Render with dt = 100ms
        const sample: GameRenderSample<any> = {
            nowMs: 200, // +100ms
            latest: { timeMs: 200, state: mockState } as any,
            previous: { timeMs: 100, state: mockState } as any,
            alpha: 1.0
        };

        client.render(sample);

        // Should move forward (X+)
        // Speed is 300 units/s. dt is 0.1s. Move should be 30 units.
        expect(client.lastRendered?.origin.x).toBeCloseTo(30);
        expect(client.lastRendered?.origin.y).toBeCloseTo(0);
        expect(client.lastRendered?.origin.z).toBeCloseTo(0);

        // Simulate 's' key down (backward), 'w' up
        client.handleInput('w', false);
        client.handleInput('s', true);

        // Render another 100ms
         const sample2: GameRenderSample<any> = {
            nowMs: 300, // +100ms
            latest: { timeMs: 300, state: mockState } as any,
            previous: { timeMs: 200, state: mockState } as any,
            alpha: 1.0
        };
        client.render(sample2);

        // Should move backward 30 units, back to 0
        expect(client.lastRendered?.origin.x).toBeCloseTo(0);
    });

    it('should follow target entity with smoothing', () => {
         client.startDemoPlayback(new ArrayBuffer(10), 'test.dm2');
         client.setDemoCameraMode(DemoCameraMode.Follow);
         const followId = 123;
         client.setDemoFollowEntity(followId);

         const mockState = {
            origin: { x: 0, y: 0, z: 0 },
            velocity: { x: 0, y: 0, z: 0 },
            viewAngles: { x: 0, y: 0, z: 0 },
            pmFlags: 0,
            frame: 1
        };
        vi.spyOn(client.demoHandler, 'getPredictionState').mockReturnValue(mockState as any);

        // Create a renderable entity at 100, 100, 100
        const transform = mat4.create();
        mat4.translate(transform, transform, [100, 100, 100]);

        vi.spyOn(client.demoHandler, 'getRenderableEntities').mockReturnValue([
            { id: followId, transform, model: {} as any, skin: {} as any, frame: 0, alpha: 1, flags: 0, renderfx: 0 }
        ]);

        // 1. Initial Frame - should snap to target
        const sample: GameRenderSample<any> = {
            nowMs: 100,
            latest: { timeMs: 100, state: mockState } as any,
            previous: { timeMs: 0, state: mockState } as any,
            alpha: 1.0
        };

        client.render(sample);

        // Should snap to target (100, 100, 100) because it's the first frame (distance > 1000 from default 0,0,0 or initialized state)
        expect(client.lastRendered?.origin.x).toBeCloseTo(100);
        expect(client.lastRendered?.origin.y).toBeCloseTo(100);
        expect(client.lastRendered?.origin.z).toBeCloseTo(100);

        // 2. Next Frame - should smooth
        // Move entity to 200, 200, 200
        const transform2 = mat4.create();
        mat4.translate(transform2, transform2, [200, 200, 200]);
        vi.spyOn(client.demoHandler, 'getRenderableEntities').mockReturnValue([
            { id: followId, transform: transform2, model: {} as any, skin: {} as any, frame: 0, alpha: 1, flags: 0, renderfx: 0 }
        ]);

        const sample2: GameRenderSample<any> = {
            nowMs: 200,
            latest: { timeMs: 200, state: mockState } as any,
            previous: { timeMs: 0, state: mockState } as any,
            alpha: 1.0
        };

        client.render(sample2);

        // Smoothing factor is 0.1
        // Current: 100, Target: 200
        // New = 100 + (200 - 100) * 0.1 = 110
        expect(client.lastRendered?.origin.x).toBeCloseTo(110);
        expect(client.lastRendered?.origin.y).toBeCloseTo(110);
        expect(client.lastRendered?.origin.z).toBeCloseTo(110);
    });
});
