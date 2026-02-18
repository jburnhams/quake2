import { DebugMode } from '../../../src/render/debugMode.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { createMockWebGL2Context, MockWebGL2RenderingContext } from '@quake2ts/test-utils';

describe('DebugMode Integration', () => {
    let mockGl: MockWebGL2RenderingContext;
    let renderer: any;
    let renderFrameMock: any;

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();

        // Use vi.doMock to ensure mocks are applied fresh for this test context
        vi.doMock('../../../src/render/bspPipeline.js', () => ({
            BspSurfacePipeline: class {
                shaderSize = 100;
                draw = vi.fn();
                bind = vi.fn();
                drawSurface = vi.fn();
            }
        }));

        vi.doMock('../../../src/render/skybox.js', () => ({
            SkyboxPipeline: class {
                shaderSize = 100;
                render = vi.fn();
            }
        }));

        vi.doMock('../../../src/render/md2Pipeline.js', () => ({
            Md2Pipeline: class {
                bind = vi.fn();
                draw = vi.fn();
                shaderSize = 100;
            }
        }));

        vi.doMock('../../../src/render/sprite.js', () => ({
            SpriteRenderer: class {
                shaderSize = 100;
                render = vi.fn();
                draw = vi.fn();
                begin = vi.fn();
                drawRect = vi.fn();
            }
        }));

        vi.doMock('../../../src/render/collisionVis.js', () => ({
            CollisionVisRenderer: class {
                render = vi.fn();
                clear = vi.fn();
                shaderSize = 100;
            }
        }));

        vi.doMock('../../../src/render/md3Pipeline.js', () => ({
            Md3Pipeline: class {
                bind = vi.fn();
                drawSurface = vi.fn();
                shaderSize = 100;
            },
            Md3ModelMesh: class {
                update = vi.fn();
                surfaces = new Map();
            },
        }));

        // Mock frame.js and capture the spy
        const mockRenderFrame = vi.fn().mockReturnValue({
            drawCalls: 0,
            vertexCount: 0,
            batches: 0,
            facesDrawn: 0,
            skyDrawn: false,
            viewModelDrawn: false,
            fps: 60,
            shaderSwitches: 0,
            visibleSurfaces: 0,
            culledSurfaces: 0,
            visibleEntities: 0,
            culledEntities: 0
        });
        vi.doMock('../../../src/render/frame.js', () => ({
            renderFrame: mockRenderFrame,
            createFrameRenderer: vi.fn(() => ({
                renderFrame: mockRenderFrame
            }))
        }));
        renderFrameMock = mockRenderFrame;

        // Mock DebugRenderer
        const mockDebugRendererInstance = {
            drawBoundingBox: vi.fn(),
            drawAxes: vi.fn(),
            render: vi.fn(),
            clear: vi.fn(),
            getLabels: vi.fn().mockReturnValue([]),
            drawLine: vi.fn(),
            shaderSize: 100,
        };
        vi.doMock('../../../src/render/debug.js', () => ({
            __esModule: true,
            DebugRenderer: class {
                constructor() {
                    return mockDebugRendererInstance;
                }
            },
        }));

        // Mock culling.js
        vi.doMock('../../../src/render/culling.js', () => ({
            __esModule: true,
            boxIntersectsFrustum: vi.fn().mockReturnValue(true),
            extractFrustumPlanes: vi.fn().mockReturnValue([]),
            transformAabb: vi.fn((min, max, mat) => ({
                mins: {x:-10,y:-10,z:-10},
                maxs: {x:10,y:10,z:10}
            }))
        }));

        // Mock bspTraversal.js
        vi.doMock('../../../src/render/bspTraversal.js', () => ({
            __esModule: true,
            findLeafForPoint: vi.fn().mockReturnValue(0),
            isClusterVisible: vi.fn().mockReturnValue(true),
            gatherVisibleFaces: vi.fn().mockReturnValue([]),
            calculateReachableAreas: vi.fn().mockReturnValue(new Set([0])),
        }));

        // Mock light.js
        vi.doMock('../../../src/render/light.js', () => ({
            __esModule: true,
            calculateEntityLight: vi.fn().mockReturnValue(1.0),
        }));

        mockGl = createMockWebGL2Context();

        // Dynamic import to pick up mocks
        const { createRenderer } = await import('../../../src/render/renderer.js');
        renderer = createRenderer(mockGl as any);
    });

    it('should trigger debug rendering in renderFrame', () => {
        renderer.setDebugMode(DebugMode.BoundingBoxes);
        const options = {
            camera: {
                viewProjectionMatrix: new Float32Array(16),
                viewMatrix: new Float32Array(16),
                position: [0, 0, 0]
            },
            cameraState: {
                position: [0, 0, 0],
                angles: [0, 0, 0],
                fov: 90,
                aspect: 1,
                near: 1,
                far: 1000
            }
        } as any;
        const entities = [{
            type: 'md3',
            model: {
                frames: [{ minBounds: {x:-10,y:-10,z:-10}, maxBounds: {x:10,y:10,z:10} }],
                surfaces: [{ name: 'test', triangles: [], vertices: [[]] }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);
    });

    it('should handle PVSClusters mode without crashing', () => {
        const options = {
            camera: {
                viewProjectionMatrix: new Float32Array(16),
                viewMatrix: new Float32Array(16),
                position: [0, 0, 0]
            },
            cameraState: {
                position: [0, 0, 0],
                angles: [0, 0, 0],
                fov: 90,
                aspect: 1,
                near: 1,
                far: 1000
            },
            world: {
                map: {
                    nodes: [{ planeIndex: 0, children: [-1, -1], mins: [0,0,0], maxs: [0,0,0] }],
                    planes: [{ normal: [0,0,1], dist: 0, type: 0 }],
                    leafs: [{ cluster: 0, mins: [0,0,0], maxs: [0,0,0] }],
                    visibility: { numClusters: 1, clusters: [{ pvs: new Uint8Array(1) }] },
                    entities: { worldspawn: { properties: { light: '255' } } },
                    faces: [],
                    leaffaces: [],
                    leafbrushes: [],
                    edges: [],
                    surfedges: [],
                    models: [],
                    brushes: [],
                    brushsides: [],
                    lightmaps: [],
                    vis: new Uint8Array(0),
                    areas: [],
                    areaPortals: []
                },
                surfaces: []
            }
        } as any;

        renderer.setDebugMode(DebugMode.PVSClusters);
        expect(() => renderer.renderFrame(options, [])).not.toThrow();
    });

    it('should handle Lightmaps mode without crashing', () => {
        const options = {
            camera: {
                viewProjectionMatrix: new Float32Array(16),
                viewMatrix: new Float32Array(16),
                position: [0, 0, 0]
            },
            cameraState: {
                position: [0, 0, 0],
                angles: [0, 0, 0],
                fov: 90,
                aspect: 1,
                near: 1,
                far: 1000
            },
            world: {
                map: {
                    nodes: [{ planeIndex: 0, children: [-1, -1], mins: [0,0,0], maxs: [0,0,0] }],
                    planes: [{ normal: [0,0,1], dist: 0, type: 0 }],
                    leafs: [{ cluster: 0, mins: [0,0,0], maxs: [0,0,0] }],
                    visibility: { numClusters: 1, clusters: [{ pvs: new Uint8Array(1) }] },
                    entities: { worldspawn: { properties: { light: '255' } } },
                    faces: [],
                    leaffaces: [],
                    leafbrushes: [],
                    edges: [],
                    surfedges: [],
                    models: [],
                    brushes: [],
                    brushsides: [],
                    lightmaps: [],
                    vis: new Uint8Array(0),
                    areas: [],
                    areaPortals: []
                },
                surfaces: []
            }
        } as any;

        renderer.setDebugMode(DebugMode.Lightmaps);
        expect(() => renderer.renderFrame(options, [])).not.toThrow();
    });
});
