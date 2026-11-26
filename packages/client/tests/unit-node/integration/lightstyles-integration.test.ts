import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@quake2ts/client';
import type { Renderer } from '@quake2ts/engine';
import { ConfigStringIndex } from '@quake2ts/shared';
import { createMockLocalStorage } from '@quake2ts/test-utils';

// CL_SetLightstyle: a CS_LIGHTS configstring sets the pattern the renderer plays for that style.
describe('light styles from configstrings', () => {
    let mockEngine: any;
    let mockHost: any;
    let mockCvars: Map<string, any>;
    let cvarHandlers: Map<string, (cvar: any) => void>;

    beforeEach(() => {
        vi.stubGlobal('localStorage', createMockLocalStorage());
        mockCvars = new Map();
        cvarHandlers = new Map();

        const createMockCvar = (name: string, defaultValue: string, flags: number, onChange?: (cvar: any) => void) => {
            let cvar = mockCvars.get(name);
            if (cvar) {
                // Update existing: respect existing value but update handler
                cvar.flags = flags;
                cvar.onChange = onChange;
            } else {
                // Create new
                cvar = {
                    name,
                    string: defaultValue,
                    number: parseFloat(defaultValue),
                    flags,
                    onChange
                };
                mockCvars.set(name, cvar);
            }

            if (onChange) {
                cvarHandlers.set(name, onChange);
            }
            return cvar;
        };

        mockHost = {
            cvars: {
                register: vi.fn((def) => createMockCvar(def.name, def.defaultValue, def.flags, def.onChange)),
                get: vi.fn((name) => mockCvars.get(name)),
                setValue: vi.fn((name, value) => {
                    const cvar = mockCvars.get(name);
                    if (cvar) {
                        cvar.string = value;
                        cvar.number = parseFloat(value);
                        const handler = cvarHandlers.get(name);
                        if (handler) handler(cvar);
                    }
                }),
                list: vi.fn(() => Array.from(mockCvars.values()))
            },
            commands: {
                register: vi.fn(),
                execute: vi.fn()
            }
        };

        mockEngine = {
            audio: {
                play_track: vi.fn(),
                play_music: vi.fn(),
                stop_music: vi.fn(),
                set_music_volume: vi.fn()
            },
            trace: vi.fn(() => ({ fraction: 1.0, endpos: { x: 0, y: 0, z: 0 }, contents: 0 })),
            assets: {
                getMap: vi.fn(),
                listFiles: vi.fn(() => [])
            },
            renderer: {
                width: 800,
                height: 600,
                renderFrame: vi.fn(),
                getPerformanceReport: vi.fn(() => ({})),
                begin2D: vi.fn(),
                end2D: vi.fn(),
                setLightStyle: vi.fn()
            } as unknown as Renderer
        };
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('hands a CS_LIGHTS configstring to the renderer as that style', () => {
        const client = createClient({ engine: mockEngine, host: mockHost });
        client.ParseConfigString(ConfigStringIndex.Lights + 6, 'nmonqnmomnmomomno');
        expect(mockEngine.renderer.setLightStyle).toHaveBeenCalledWith(6, 'nmonqnmomnmomomno');
    });

    it('leaves other configstrings alone', () => {
        const client = createClient({ engine: mockEngine, host: mockHost });
        client.ParseConfigString(ConfigStringIndex.CdTrack, '0');
        client.ParseConfigString(ConfigStringIndex.ShadowLights, 'x');
        expect(mockEngine.renderer.setLightStyle).not.toHaveBeenCalled();
    });
});
