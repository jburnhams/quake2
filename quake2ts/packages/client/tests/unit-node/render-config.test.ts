import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient, ClientImports } from '@quake2ts/client/index.js';
import { EngineImports, Renderer } from '@quake2ts/engine';
import { EngineHost, Cvar, CvarFlags } from '@quake2ts/engine';
import { CONTENTS_WATER } from '@quake2ts/shared';

describe('Client Renderer Configuration', () => {
  let mockRenderer: Renderer;
  let mockEngine: EngineImports;
  let mockCvars: Map<string, Cvar>;
  let mockHost: EngineHost;
  let clientImports: ClientImports;

  beforeEach(() => {
    mockRenderer = {
      setGamma: vi.fn(),
      setBrightness: vi.fn(),
      setUnderwaterWarp: vi.fn(),
      setBloom: vi.fn(),
      setBloomIntensity: vi.fn(),
      renderFrame: vi.fn(() => ({})), // Mock renderFrame returning empty stats
      width: 800,
      height: 600,
      getPerformanceReport: vi.fn(() => ({})),
      begin2D: vi.fn(),
      end2D: vi.fn(),
      drawPic: vi.fn(),
      drawString: vi.fn(),
      drawCenterString: vi.fn(),
      drawfillRect: vi.fn(),
      // ... minimal mocks for other methods if needed
    } as unknown as Renderer;

    mockEngine = {
      renderer: mockRenderer,
      trace: vi.fn().mockReturnValue({ contents: 0, fraction: 1.0, endpos: { x: 0, y: 0, z: 0 } }),
      // ... minimal engine imports
    } as unknown as EngineImports;

    mockCvars = new Map();
    mockHost = {
      cvars: {
        register: vi.fn((config) => {
          mockCvars.set(config.name, {
            name: config.name,
            string: config.defaultValue || '',
            number: parseFloat(config.defaultValue || '0'),
            flags: config.flags || 0,
            modified: false,
            description: config.description
          } as Cvar);
          // Store the onChange callback to trigger it manually in tests
          if (config.onChange) {
            (mockCvars.get(config.name) as any).onChange = config.onChange;
          }
        }),
        get: vi.fn((name) => mockCvars.get(name)),
        list: vi.fn(() => Array.from(mockCvars.values())),
        setValue: vi.fn(),
      },
      commands: {
        register: vi.fn(),
      }
    } as unknown as EngineHost;

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
        const gammaCvar = mockCvars.get('vid_gamma') as any;
        expect(gammaCvar).toBeDefined();

        // Simulate Cvar change
        gammaCvar.number = 1.5;
        gammaCvar.onChange(gammaCvar);

        expect(mockRenderer.setGamma).toHaveBeenCalledWith(1.5);
      });

      it('should update renderer brightness when r_brightness changes', () => {
        createClient(clientImports);
        const brightnessCvar = mockCvars.get('r_brightness') as any;
        expect(brightnessCvar).toBeDefined();

        // Simulate Cvar change
        brightnessCvar.number = 0.8;
        brightnessCvar.onChange(brightnessCvar);

        expect(mockRenderer.setBrightness).toHaveBeenCalledWith(0.8);
      });

      it('should apply initial gamma and brightness in Init', () => {
        // Pre-set values in the mock cvar system before Init is called
        // createClient registers them, but let's assume they have values from storage
        const client = createClient(clientImports);

        // Simulate that cvars have non-default values
        const gammaCvar = mockCvars.get('vid_gamma')!;
        gammaCvar.number = 2.2;

        const brightnessCvar = mockCvars.get('r_brightness')!;
        brightnessCvar.number = 1.2;

        client.Init();

        expect(mockRenderer.setGamma).toHaveBeenCalledWith(2.2);
        expect(mockRenderer.setBrightness).toHaveBeenCalledWith(1.2);
      });

      it('should update renderer bloom when r_bloom changes', () => {
          createClient(clientImports);
          const bloomCvar = mockCvars.get('r_bloom') as any;

          bloomCvar.number = 1;
          bloomCvar.onChange(bloomCvar);
          expect(mockRenderer.setBloom).toHaveBeenCalledWith(true);

          bloomCvar.number = 0;
          bloomCvar.onChange(bloomCvar);
          expect(mockRenderer.setBloom).toHaveBeenCalledWith(false);
      });

      it('should update renderer bloom intensity when r_bloom_intensity changes', () => {
          createClient(clientImports);
          const intensityCvar = mockCvars.get('r_bloom_intensity') as any;

          intensityCvar.number = 0.8;
          intensityCvar.onChange(intensityCvar);
          expect(mockRenderer.setBloomIntensity).toHaveBeenCalledWith(0.8);
      });
  });

  describe('Underwater Distortion', () => {
      it('should enable underwater warp when camera is in water', () => {
          const client = createClient(clientImports);
          client.Init();

          // Mock trace to return water contents
          // trace is used by pointContents adapter in createClient
          mockEngine.trace = vi.fn().mockReturnValue({
              contents: CONTENTS_WATER,
              fraction: 1.0,
              endpos: { x: 0, y: 0, z: 0 }
          });

          // Mock a prediction state to allow render to proceed
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
                      client: {} // Needed to trigger HUD/World render
                  }
              },
              previous: null,
              alpha: 0
          };

          // We also need to ensure lastRendered is set, which happens via predict or Init
          // Calling render with sample will set it.

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
