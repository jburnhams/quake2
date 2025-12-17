import { describe, expect, it, vi, beforeEach } from 'vitest';
import { createClient, ClientImports } from '../src/index.js';
import { EngineImports, EngineHost, Renderer } from '@quake2ts/engine';
import { CvarFlags, ConfigStringIndex } from '@quake2ts/shared';

describe('Music Integration', () => {
    let mockEngine: any;
    let mockHost: any;
    let mockCvars: Map<string, any>;
    let cvarHandlers: Map<string, (cvar: any) => void>;

    beforeEach(() => {
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
                end2D: vi.fn()
            } as unknown as Renderer
        };
    });

    it('should set music volume when s_musicvolume changes', () => {
        const imports: ClientImports = {
            engine: mockEngine,
            host: mockHost
        };

        createClient(imports);

        // Verify initial registration
        expect(mockHost.cvars.register).toHaveBeenCalledWith(expect.objectContaining({
            name: 's_musicvolume',
            defaultValue: '1'
        }));

        // Change cvar
        mockHost.cvars.setValue('s_musicvolume', '0.5');

        expect(mockEngine.audio.set_music_volume).toHaveBeenCalledWith(0.5);

        // Change cvar again
        mockHost.cvars.setValue('s_musicvolume', '0.0');
        expect(mockEngine.audio.set_music_volume).toHaveBeenCalledWith(0.0);
    });

    it('should initialize music volume from existing cvar', () => {
        // Pre-populate cvar
        mockCvars.set('s_musicvolume', {
            name: 's_musicvolume',
            string: '0.3',
            number: 0.3,
            flags: CvarFlags.Archive
        });

        const imports: ClientImports = {
            engine: mockEngine,
            host: mockHost
        };

        createClient(imports);

        expect(mockEngine.audio.set_music_volume).toHaveBeenCalledWith(0.3);
    });

    it('should play music track when CD track config string changes', () => {
        const imports: ClientImports = {
            engine: mockEngine,
            host: mockHost
        };

        const client = createClient(imports);

        // Simulate config string change for CD Track (ConfigStringIndex.CdTrack usually)
        // Note: The index isn't exported as a constant from client/src/index.ts easily without importing from shared
        // But we import ConfigStringIndex from @quake2ts/shared in the test file.

        // Track 5
        client.ParseConfigString(ConfigStringIndex.CdTrack, '5');
        expect(mockEngine.audio.play_track).toHaveBeenCalledWith(5);

        // Track 0 (Stop)
        client.ParseConfigString(ConfigStringIndex.CdTrack, '0');
        expect(mockEngine.audio.stop_music).toHaveBeenCalled();
    });

    it('should fallback to play_music with OGG path if play_track is missing', () => {
        const engineWithoutPlayTrack = { ...mockEngine };
        delete engineWithoutPlayTrack.audio.play_track;

        const imports: ClientImports = {
            engine: engineWithoutPlayTrack,
            host: mockHost
        };

        const client = createClient(imports);

        client.ParseConfigString(ConfigStringIndex.CdTrack, '9');
        expect(mockEngine.audio.play_music).toHaveBeenCalledWith('music/track09.ogg');
    });
});
