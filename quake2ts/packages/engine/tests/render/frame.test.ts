import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFrameRenderer, type FrameRenderOptions } from '../../src/render/frame.js';
import type { BspSurfacePipeline } from '../../src/render/bspPipeline.js';
import { removeViewTranslation, type SkyboxPipeline } from '../../src/render/skybox.js';
import type { BspSurfaceGeometry } from '../../src/render/bsp.js';
import { Camera } from '../../src/render/camera.js';
import { mat4, vec3 } from 'gl-matrix';
import { createMockWebGL2Context } from '@quake2ts/test-utils';

let callOrder: string[] = [];

function createStubGeometry(label: string, surfaceFlags = 0): BspSurfaceGeometry {
  return {
    vao: { bind: vi.fn(() => callOrder.push(`${label}-vao`)) } as any,
    vertexBuffer: {} as any,
    indexBuffer: { bind: vi.fn(() => callOrder.push(`${label}-ibo`)), buffer: {} as any } as any,
    indexCount: 6,
    texture: label,
    surfaceFlags,
    lightmap: { atlasIndex: 0, offset: [0, 0], scale: [1, 1] },
    vertexData: new Float32Array(),
    indexData: new Uint16Array(),
  };
}

describe('FrameRenderer', () => {
  beforeEach(() => {
    callOrder = [];
  });

  const makeRenderer = (depsOverrides = {}, glOverrides: Partial<WebGL2RenderingContext> = {}) => {
    const gl = createMockWebGL2Context({
      clearColor: vi.fn(),
      clear: vi.fn(),
      COLOR_BUFFER_BIT: 0x1,
      DEPTH_BUFFER_BIT: 0x2,
      depthRange: vi.fn(),
    }, glOverrides) as unknown as WebGL2RenderingContext;

    const bspPipeline = {
      bind: vi.fn(() => ({
        alpha: 1,
        blend: false,
        depthWrite: true,
        warp: false,
        flowOffset: [0, 0],
        sky: false,
      })),
      draw: vi.fn(), // Mock draw method
    } as unknown as BspSurfacePipeline;

    const skyboxPipeline = {
      bind: vi.fn(),
      draw: vi.fn(() => callOrder.push('sky-draw')),
      gl: { depthMask: vi.fn() },
    } as unknown as SkyboxPipeline;

    const deps = {
      gatherVisibleFaces: vi.fn(() => [
        { faceIndex: 1, leafIndex: 0, sortKey: -4 },
        { faceIndex: 0, leafIndex: 0, sortKey: -1 },
      ]),
      extractFrustumPlanes: vi.fn(() => []),
      computeSkyScroll: vi.fn(() => [0.1, 0.2]),
      removeViewTranslation: vi.fn(removeViewTranslation),
      ...depsOverrides,
    } as any;

    const renderer = createFrameRenderer(gl, bspPipeline, skyboxPipeline, deps);
    return { gl, bspPipeline, skyboxPipeline, deps, renderer };
  };

  it('clears buffers and renders sky with translation removed', () => {
    const { gl, skyboxPipeline, deps, renderer } = makeRenderer();
    const camera = new Camera();
    camera.position = vec3.fromValues(10, 20, 30);

    const options: FrameRenderOptions = {
      camera,
      clearColor: [0.2, 0.3, 0.4, 1],
      sky: { scrollSpeeds: [0.05, 0.1], textureUnit: 2 },
    };

    const stats = renderer.renderFrame(options);

    expect(gl.clearColor).toHaveBeenCalledWith(0.2, 0.3, 0.4, 1);
    expect(gl.clear).toHaveBeenCalledWith(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    expect(deps.removeViewTranslation).toHaveBeenCalledWith(camera.viewMatrix);
    expect(deps.computeSkyScroll).toHaveBeenCalledWith(0, [0.05, 0.1]);
    expect(skyboxPipeline.bind).toHaveBeenCalled();
    expect((skyboxPipeline.bind as any).mock.calls[0][0].scroll).toEqual([0.1, 0.2]);
    expect((skyboxPipeline.bind as any).mock.calls[0][0].textureUnit).toBe(2);
    expect((skyboxPipeline.gl.depthMask as any)).toHaveBeenCalledWith(true);
    expect(callOrder).toContain('sky-draw');
    expect(stats.skyDrawn).toBe(true);
    expect(stats.viewModelDrawn).toBe(false);
  });

  it('gathers visible faces, sorts front-to-back, and binds textures/lightmaps', () => {
    const { gl, bspPipeline, deps, renderer } = makeRenderer();
    const diffuse = { bind: vi.fn(() => callOrder.push('diffuse')) } as any;
    const lightmapTexture = { bind: vi.fn(() => callOrder.push('lightmap')) } as any;

    const world = {
      map: {
        faces: [
          { styles: [1, 255, 255, 255] },
          { styles: [0, 2, 3, 255] },
        ],
      },
      surfaces: [createStubGeometry('first'), createStubGeometry('second')],
      lightmaps: [{ texture: lightmapTexture }],
      textures: new Map([
        ['first', diffuse],
        ['second', diffuse],
      ]),
      lightStyles: [0, 0.5, 0.75],
    } as any;

    const camera = new Camera();
    camera.position = vec3.fromValues(1, 2, 3);

    const stats = renderer.renderFrame({ camera, world, timeSeconds: 1 });

    const expectedViewProj = Array.from(new Float32Array(camera.viewProjectionMatrix));
    expect(deps.extractFrustumPlanes).toHaveBeenCalledWith(expectedViewProj);
    expect(deps.gatherVisibleFaces).toHaveBeenCalledWith(
      world.map,
      { x: 1, y: 2, z: 3 },
      [],
      undefined
    );
    expect(callOrder).toEqual([
      'diffuse',
      'lightmap',
      'diffuse',
      'lightmap',
    ]);

    const bindCalls = (bspPipeline.bind as any).mock.calls;
    expect(bindCalls[0][0].styleIndices).toEqual([1, 255, 255, 255]);
    expect(bindCalls[0][0].styleValues).toBe(world.lightStyles);
    expect(bindCalls[1][0].styleIndices).toEqual([0, 2, 3, 255]);

    expect(diffuse.bind).toHaveBeenCalledTimes(2);
    expect(lightmapTexture.bind).toHaveBeenCalled();
    expect(bspPipeline.draw).toHaveBeenCalledTimes(2);
    expect(stats.facesDrawn).toBe(2);
    expect(stats.drawCalls).toBe(2);
    expect(stats.batches).toBe(2);
  });

  it('disables lightmap sampling when a surface lacks an atlas placement', () => {
    const { bspPipeline, renderer, deps } = makeRenderer({
      gatherVisibleFaces: vi.fn(() => [{ faceIndex: 0, leafIndex: 0, sortKey: -1 }]),
    });

    const diffuse = { bind: vi.fn(() => callOrder.push('diffuse')) } as any;

    const world = {
      map: { faces: [{ styles: [0, 255, 255, 255] }] },
      surfaces: [
        {
          ...createStubGeometry('nolight'),
          lightmap: undefined,
          surfaceFlags: 0,
        },
      ],
      lightmaps: [],
      textures: new Map([['nolight', diffuse]]),
      lightStyles: [],
    } as any;

    const camera = new Camera();
    const stats = renderer.renderFrame({ camera, world });

    expect(deps.gatherVisibleFaces).toHaveBeenCalled();
    expect(callOrder).toEqual(['diffuse']);
    expect((bspPipeline.bind as any).mock.calls[0][0].lightmapSampler).toBeUndefined();
    expect(stats.facesDrawn).toBe(1);
  });

  it('skips drawing sky surfaces that were gathered from visibility', () => {
    const { gl, renderer, deps, bspPipeline } = makeRenderer({
      gatherVisibleFaces: vi.fn(() => [
        { faceIndex: 0, leafIndex: 0, sortKey: -1 },
        { faceIndex: 1, leafIndex: 0, sortKey: -2 },
      ]),
    });

    const world = {
      map: { faces: [{ styles: [0, 255, 255, 255] }, { styles: [0, 255, 255, 255] }] },
      surfaces: [
        createStubGeometry('sky', 0x04),
        createStubGeometry('floor'),
      ],
      lightmaps: [{ texture: { bind: vi.fn(() => callOrder.push('lm')) } }],
      textures: new Map([
        ['sky', { bind: vi.fn(() => callOrder.push('sky-tex')) } as any],
        ['floor', { bind: vi.fn(() => callOrder.push('floor-tex')) } as any],
      ]),
      lightStyles: [],
    } as any;

    const camera = new Camera();
    const stats = renderer.renderFrame({ camera, world });

    expect(deps.gatherVisibleFaces).toHaveBeenCalled();
    expect(bspPipeline.draw).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['floor-tex', 'lm']);
    expect(stats.facesDrawn).toBe(1);
    expect(stats.batches).toBe(1);
  });

  it('reuses batch state when surfaces share materials and styles', () => {
    const { renderer, bspPipeline } = makeRenderer({
      gatherVisibleFaces: vi.fn(() => [
        { faceIndex: 0, leafIndex: 0, sortKey: -1 },
        { faceIndex: 1, leafIndex: 0, sortKey: -2 },
      ]),
    });

    const diffuse = { bind: vi.fn(() => callOrder.push('diffuse')) } as any;
    const lightmapTexture = { bind: vi.fn(() => callOrder.push('lightmap')) } as any;

    const world = {
      map: { faces: [{ styles: [0, 0, 0, 0] }, { styles: [0, 0, 0, 0] }] },
      surfaces: [createStubGeometry('a'), createStubGeometry('b')],
      lightmaps: [{ texture: lightmapTexture }],
      textures: new Map([
        ['a', diffuse],
        ['b', diffuse],
      ]),
      lightStyles: [1, 1, 1, 1],
    } as any;

    const camera = new Camera();
    const stats = renderer.renderFrame({ camera, world, timeSeconds: 5 });

    expect(stats.batches).toBe(1);
    expect(stats.facesDrawn).toBe(2);
    expect((bspPipeline.bind as any).mock.calls).toHaveLength(1);
    expect(diffuse.bind).toHaveBeenCalledTimes(1);
    expect(lightmapTexture.bind).toHaveBeenCalledTimes(1);
  });

  it('renders the viewmodel with separate projection and depth range while anchored to the camera', () => {
    const viewModelDraw = vi.fn();
    const { gl, renderer } = makeRenderer();
    const camera = new Camera();
    camera.fov = 100;
    camera.position = vec3.fromValues(5, 6, 7);

    const stats = renderer.renderFrame({
      camera,
      viewModel: {
        fov: 80,
        depthRange: [0.2, 0.6],
        draw: viewModelDraw,
      },
    });

    const expectedProjection = camera.getViewmodelProjectionMatrix(80);
    const expectedView = removeViewTranslation(camera.viewMatrix);
    const expectedViewProjection = mat4.create();
    mat4.multiply(expectedViewProjection, expectedProjection, expectedView);

    expect(viewModelDraw).toHaveBeenCalledTimes(1);
    expect(Array.from(viewModelDraw.mock.calls[0][0] as Float32Array)).toEqual(
      Array.from(new Float32Array(expectedViewProjection))
    );
    expect(gl.depthRange).toHaveBeenCalledWith(0.2, 0.6);
    expect(gl.depthRange).toHaveBeenCalledWith(0, 1);
    expect(stats.viewModelDrawn).toBe(true);
  });
});
