import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientImports } from '@quake2ts/client/index.js';
import { EngineImports, Renderer } from '@quake2ts/engine';
import { createMockRenderer, createMockEngineHost, createMockLocalStorage } from '@quake2ts/test-utils';
import { CONTENTS_WATER } from '@quake2ts/shared';

describe('Client Renderer Configuration', () => {
  let mockRenderer: Renderer;
  let mockEngine: EngineImports;
  let mockHost: any; // Using any to access mock internals if needed, though EngineHost interface is mostly sufficient
  let clientImports: ClientImports;

  beforeEach(() => {
    global.localStorage = createMockLocalStorage();

    mockRenderer = createMockRenderer({
      width: 800,
      height: 600,
      getPerformanceReport: vi.fn(() => ({})),
      setGamma: vi.fn(),
      setBrightness: vi.fn(),
      setUnderwaterWarp: vi.fn(),
      setBloom: vi.fn(),
      setBloomIntensity: vi.fn(),
    });

    mockEngine = {
      renderer: mockRenderer,
      trace: vi.fn().mockReturnValue({ contents: 0, fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
      assets: {
          loadTexture: vi.fn().mockResolvedValue({}),
          loadMd2Model: vi.fn().mockResolvedValue({}),
          loadMd3Model: vi.fn().mockResolvedValue({}),
          loadSprite: vi.fn().mockResolvedValue({}),
          loadSound: vi.fn().mockResolvedValue({}),
      } as any
    } as unknown as EngineImports;

    mockHost = createMockEngineHost();

    clientImports = {
      engine: mockEngine,
      host: mockHost,
    };
  });

  describe('Gamma and Brightness', () => {
      it('should register vid_gamma and r_brightness cvars', () => {
        createClient(clientImports);

        expect(mockHost.cvars.register).toHaveBeenCalledWith(expect.objectContaining({
          name: 'vid_gamma',
          defaultValue: '1.0'
        }));

        expect(mockHost.cvars.register).toHaveBeenCalledWith(expect.objectContaining({
          name: 'r_brightness',
          defaultValue: '1.0'
        }));
      });

      it('should update renderer gamma when vid_gamma changes', () => {
        createClient(clientImports);

        // Simulate Cvar change via host
        mockHost.cvars.setValue('vid_gamma', '1.5');

        expect(mockRenderer.setGamma).toHaveBeenCalledWith(1.5);
      });

      it('should update renderer brightness when r_brightness changes', () => {
        createClient(clientImports);

        // Simulate Cvar change
        mockHost.cvars.setValue('r_brightness', '0.8');

        expect(mockRenderer.setBrightness).toHaveBeenCalledWith(0.8);
      });

      it('should apply initial gamma and brightness in Init', () => {
        // createClient registers cvars
        const client = createClient(clientImports);

        // Simulate that cvars have non-default values (e.g. loaded from config)
        mockHost.cvars.setValue('vid_gamma', '2.2');
        mockHost.cvars.setValue('r_brightness', '1.2');

        client.Init();

        expect(mockRenderer.setGamma).toHaveBeenCalledWith(2.2);
        expect(mockRenderer.setBrightness).toHaveBeenCalledWith(1.2);
      });

      it('should update renderer bloom when r_bloom changes', () => {
          createClient(clientImports);

          mockHost.cvars.setValue('r_bloom', '1');
          expect(mockRenderer.setBloom).toHaveBeenCalledWith(true);

          mockHost.cvars.setValue('r_bloom', '0');
          expect(mockRenderer.setBloom).toHaveBeenCalledWith(false);
      });

      it('should update renderer bloom intensity when r_bloom_intensity changes', () => {
          createClient(clientImports);

          mockHost.cvars.setValue('r_bloom_intensity', '0.8');
          expect(mockRenderer.setBloomIntensity).toHaveBeenCalledWith(0.8);
      });
  });

  describe('Underwater Distortion', () => {
      it('should enable underwater warp when camera is in water', () => {
          const client = createClient(clientImports);
          client.Init();

          // Mock trace to return water contents
          mockEngine.trace = vi.fn().mockReturnValue({
              contents: CONTENTS_WATER,
              fraction: 1.0,
              endpos: { x: 0, y: 0, z: 0 }
          });

          const sample = {
              nowMs: 1000,
              latest: {
                  timeMs: 1000,
                  state: {
                      origin: { x: 0, y: 0, z: 0 },
                      viewAngles: { x: 0, y: 0, z: 0 },
                      velocity: { x: 0, y: 0, z: 0 },
                      pmFlags: 0,
                      waterLevel: 0,
                      watertype: 0,
                      client: {}
                  }
              },
              previous: null,
              alpha: 0
          };

          client.render(sample as any);

          expect(mockRenderer.setUnderwaterWarp).toHaveBeenCalledWith(true);
      });

      it('should disable underwater warp when camera is not in water', () => {
        const client = createClient(clientImports);
        client.Init();

        // Mock trace to return 0 (air)
        mockEngine.trace = vi.fn().mockReturnValue({
            contents: 0,
            fraction: 1.0,
            endpos: { x: 0, y: 0, z: 0 }
        });

         const sample = {
            nowMs: 1000,
            latest: {
                timeMs: 1000,
                state: {
                    origin: { x: 0, y: 0, z: 0 },
                    viewAngles: { x: 0, y: 0, z: 0 },
                    velocity: { x: 0, y: 0, z: 0 },
                    pmFlags: 0,
                    waterLevel: 0,
                    watertype: 0,
                     client: {}
                }
            },
            previous: null,
            alpha: 0
        };

        client.render(sample as any);

        expect(mockRenderer.setUnderwaterWarp).toHaveBeenCalledWith(false);
      });
  });
});
