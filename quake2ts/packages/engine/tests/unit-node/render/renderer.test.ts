import { FrameRenderer, RenderModeConfig } from '../../../src/render/frame.js';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    createMockWebGL2Context,
    createMockBspPipeline,
    createMockSkyboxPipeline,
    createMockMd2Pipeline,
    createMockSpritePipeline,
    createMockMd3Pipeline,
    createMockFrameRenderer
} from '@quake2ts/test-utils';
import { Md3ModelMesh, Md3Pipeline } from '../../../src/render/md3Pipeline.js';
import { Texture2D } from '../../../src/render/resources.js';
import path from 'path';

describe('Renderer', () => {
    let mockGl: WebGL2RenderingContext;
    let createRenderer: typeof import('../../../src/render/renderer.js').createRenderer;
    let mockMd3Pipeline: Md3Pipeline;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        // Use doMock to leverage test-utils dynamically
        vi.doMock('../../../src/render/bspPipeline', () => {
            return {
                BspSurfacePipeline: class {
                    constructor() {
                        return createMockBspPipeline({ shaderSize: 100 });
                    }
                }
            };
        });

        vi.doMock('../../../src/render/skybox', () => {
            return {
                SkyboxPipeline: class {
                    constructor() {
                        return createMockSkyboxPipeline({ shaderSize: 100 });
                    }
                },
                computeSkyScroll: vi.fn(),
                removeViewTranslation: vi.fn(),
            };
        });

        vi.doMock('../../../src/render/md2Pipeline', () => {
            return {
                Md2Pipeline: class {
                    constructor() {
                        return createMockMd2Pipeline({ shaderSize: 100 });
                    }
                }
            };
        });

        vi.doMock('../../../src/render/sprite', () => {
            return {
                SpriteRenderer: class {
                    constructor() {
                        return createMockSpritePipeline({ shaderSize: 100 });
                    }
                }
            };
        });

        // Mock PVS/BSP traversal to avoid complex map data setup
        vi.doMock('../../../src/render/bspTraversal', () => ({
            findLeafForPoint: vi.fn().mockReturnValue(0), // Return a valid leaf index
            isClusterVisible: vi.fn().mockReturnValue(true),
            gatherVisibleFaces: vi.fn().mockReturnValue([]),
        }));

        // Mock light calculation to avoid map entity access
        vi.doMock('../../../src/render/light', () => ({
            calculateEntityLight: vi.fn().mockReturnValue(1.0),
        }));

        vi.doMock('../../../src/render/collisionVis', () => {
            return {
                CollisionVisRenderer: class {
                    constructor() {
                        return {
                            render: vi.fn(),
                            clear: vi.fn(),
                            shaderSize: 100,
                            dispose: vi.fn()
                        };
                    }
                }
            };
        });

        // Prepare mock for MD3 pipeline to spy on it
        mockMd3Pipeline = createMockMd3Pipeline({ shaderSize: 100 });

        vi.doMock('../../../src/render/md3Pipeline', () => {
            return {
                Md3Pipeline: class {
                    constructor() {
                        return mockMd3Pipeline;
                    }
                },
                Md3ModelMesh: class {
                    constructor() {
                        return {
                            surfaces: new Map([['test', {
                                geometry: { vertices: new Array(10) }, // Mock 10 vertices
                                update: vi.fn()
                            }]]),
                            update: vi.fn(),
                        };
                    }
                },
            };
        });

        // Frame renderer mock using test-utils
        vi.doMock('../../../src/render/frame.js', () => {
            const mockFrameRenderer = createMockFrameRenderer({
                renderFrame: vi.fn((...args) => {
                    console.log('MockFrameRenderer.renderFrame called with:', args);
                    return {
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
                    };
                }),
            });
            return {
                createFrameRenderer: vi.fn(() => mockFrameRenderer),
            };
        });

        const mod = await import('../../../src/render/renderer.js');
        createRenderer = mod.createRenderer;

        mockGl = createMockWebGL2Context({
            getExtension: vi.fn().mockReturnValue({}), // Mock extension support for Profiler
            canvas: { width: 640, height: 480 } as any
        }) as unknown as WebGL2RenderingContext;
    });

    afterEach(() => {
        vi.resetModules();
    });

    it('should set initial GL state and call the underlying frame renderer', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entities: any[] = [];

        renderer.renderFrame(options, entities);

        expect(mockGl.disable).toHaveBeenCalled();
        expect(mockGl.enable).toHaveBeenCalled();
        expect(mockGl.depthMask).toHaveBeenCalled();
    });

    it('should render an MD3 entity', () => {
        const renderer = createRenderer(mockGl);
        const options = { camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] } } as any;
        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test', triangles: [], vertices: [[]] }],
                frames: [
                    { minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }
                ]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockMd3Pipeline.bind).toHaveBeenCalledTimes(1);
        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledTimes(1);
    });

    it('should bind textures for MD3 entities', () => {
        const renderer = createRenderer(mockGl);
        const mockTexture = { bind: vi.fn() } as unknown as Texture2D;
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] },
            world: {
                textures: new Map([['test_skin', mockTexture]]),
                // Mock map with basic structure expected by PVS logic
                map: {
                    nodes: [{ planeIndex: 0, children: [-1, -1], mins: [0,0,0], maxs: [0,0,0] }],
                    planes: [{ normal: [0,0,1], dist: 0, type: 0 }],
                    leafs: [{ cluster: 0, mins: [0,0,0], maxs: [0,0,0] }],
                    visibility: { numClusters: 1, clusters: [{ pvs: new Uint8Array(1) }] },
                    entities: { worldspawn: { properties: { light: '255' } } }
                },
            }
        } as any;
        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test', triangles: [], vertices: [[]] }],
                frames: [
                    { minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }
                ]
            },
            skins: new Map([['test', 'test_skin']]),
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockTexture.bind).toHaveBeenCalledWith(0);
    });

    it('should pass RenderMode configuration to pipeline when textures are missing and not applyToAll', () => {
        const renderer = createRenderer(mockGl);
        const renderMode: RenderModeConfig = { mode: 'wireframe', applyToAll: false };
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] },
            renderMode
        } as any;

        const entities = [{
            type: 'md3',
            model: {
                surfaces: [{ name: 'test', triangles: [], vertices: [[]] }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
            // Missing skins
        }] as any;

        renderer.renderFrame(options, entities);

        // Verify drawSurface is called with options containing renderMode
        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            renderMode: renderMode
        }));
    });

    it('should generate random color when configured for entity with ID', () => {
         const renderer = createRenderer(mockGl);
        const renderMode: RenderModeConfig = {
            mode: 'solid',
            applyToAll: true,
            generateRandomColor: true
        };
        const options = {
            camera: { viewProjectionMatrix: new Float32Array(16), viewMatrix: new Float32Array(16), position: [0, 0, 0] },
            renderMode
        } as any;

        const entities = [{
            type: 'md3',
            id: 12345,
            model: {
                surfaces: [{ name: 'test', triangles: [], vertices: [[]] }],
                frames: [{ minBounds: {x: -10, y: -10, z: -10}, maxBounds: {x: 10, y: 10, z: 10} }]
            },
            blend: { frame0: 0, frame1: 0, lerp: 0 },
            transform: new Float32Array(16),
        }] as any;

        renderer.renderFrame(options, entities);

        expect(mockMd3Pipeline.drawSurface).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            renderMode: expect.objectContaining({
                mode: 'solid',
                color: expect.any(Array) // Should have generated a color array
            })
        }));

        const callArgs = mockMd3Pipeline.drawSurface.mock.calls[0][1];
        expect(callArgs.renderMode.color).toHaveLength(4);
    });
});
