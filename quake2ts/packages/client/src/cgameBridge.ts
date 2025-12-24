import { CGameImport, CGameExport } from '@quake2ts/cgame';
import { ClientImports } from './index.js';
import { PmoveTraceResult, Vec3 } from '@quake2ts/shared';
import { ClientConfigStrings } from './configStrings.js';
import { Pic } from '@quake2ts/engine';

export interface ClientStateProvider {
  tickRate: number;
  frameTimeMs: number;
  serverFrame: number;
  serverProtocol: number;
  configStrings: ClientConfigStrings;
  getClientName(num: number): string;
  getKeyBinding(key: string): string;
  inAutoDemo: boolean;
}

// Stub implementation of CGameImport using existing client/engine state
export function createCGameImport(
    imports: ClientImports,
    state: ClientStateProvider,
    onPrint?: (msg: string) => void
): CGameImport {
    // Local cache for texture handles to Pic objects
    // CGame uses handles (unknown), we use strings as handles.
    const picCache = new Map<string, Pic>();
    const pendingPics = new Set<string>();

    const getRenderer = () => imports.engine.renderer;

    return {
        // Frame timing
        get tick_rate() { return state.tickRate; },
        get frame_time_s() { return state.frameTimeMs / 1000.0; },
        get frame_time_ms() { return state.frameTimeMs; },

        // Console
        Com_Print: (msg: string) => {
             // Route to console system if exists
            console.log(`[CGAME] ${msg}`);
            if (onPrint) {
                onPrint(msg);
            }
        },
        Com_Error: (msg: string) => {
            console.error(`[CGAME ERROR] ${msg}`);
            if (onPrint) {
                onPrint(`^1[ERROR] ${msg}`);
            }
        },

        // Config strings
        get_configstring: (num: number) => {
            return state.configStrings.get(num) || '';
        },

        // Memory (No-op in JS)
        TagMalloc: (size: number, tag: number) => ({}),
        TagFree: (ptr: unknown) => {},
        FreeTags: (tag: number) => {},

        // Cvars
        cvar: (name: string, value: string, flags: number) => {
            if (!imports.host || !imports.host.cvars) {
                return null;
            }

            // Check if existing
            const existing = imports.host.cvars.get(name);
            if (existing) {
                return existing;
            }

            // Register new cvar
            return imports.host.cvars.register({
                name,
                defaultValue: value,
                flags,
            });
        },
        Cvar_Get: (name: string, value: string, flags: number) => {
            if (!imports.host || !imports.host.cvars) {
                // Return dummy if no host
                return { value: parseInt(value) || 0 };
            }
             // Check if existing
            let existing = imports.host.cvars.get(name);
            if (!existing) {
                 // Register new cvar
                existing = imports.host.cvars.register({
                    name,
                    defaultValue: value,
                    flags,
                });
            }

            // Return proxy object
            return {
                get value() { return existing!.number; }
            };
        },
        cvar_set: (name: string, value: string) => {
            imports.host?.cvars?.setValue(name, value);
        },
        cvar_forceset: (name: string, value: string) => {
            // Force set ignoring flags (if API supported)
            // For now, CvarRegistry.setValue doesn't strictly enforce flags like LATCH internally for every call,
            // but usually ForceSet implies overriding read-only or similar.
            // Our CvarRegistry.setValue is basic.
            imports.host?.cvars?.setValue(name, value);
        },

        // Client state
        CL_FrameValid: () => true, // Always assume valid for now
        CL_FrameTime: () => state.frameTimeMs,
        CL_ClientTime: () => state.frameTimeMs, // Use frame time as client time
        CL_ServerFrame: () => state.serverFrame,
        CL_ServerProtocol: () => state.serverProtocol,

        // Client info
        CL_GetClientName: (playerNum: number) => {
            return state.getClientName(playerNum);
        },
        CL_GetClientPic: (playerNum: number) => {
            // TODO: Skin/icon logic
            return '';
        },
        CL_GetClientDogtag: (playerNum: number) => {
             return '';
        },
        CL_GetKeyBinding: (key: string) => {
            return state.getKeyBinding(key);
        },

        // Asset Registration
        RegisterModel: (name: string) => {
            if (!imports.engine.assets) return;
            const ext = name.split('.').pop()?.toLowerCase();
            if (ext === 'md2') {
                imports.engine.assets.loadMd2Model(name).catch(e => console.warn(`Failed to precache MD2 ${name}`, e));
            } else if (ext === 'sp2') {
                imports.engine.assets.loadSprite(name).catch(e => console.warn(`Failed to precache Sprite ${name}`, e));
            } else if (ext === 'md3') {
                imports.engine.assets.loadMd3Model(name).catch(e => console.warn(`Failed to precache MD3 ${name}`, e));
            }
        },
        RegisterSound: (name: string) => {
             if (imports.engine.assets) {
                 imports.engine.assets.loadSound(name).catch(e => console.warn(`Failed to precache sound ${name}`, e));
             }
        },

        // Drawing
        Draw_RegisterPic: (name: string) => {
            if (picCache.has(name)) {
                return name;
            }
            if (pendingPics.has(name)) {
                return name;
            }

            // Initiate load
            pendingPics.add(name);

            // We need to find the asset.
            // CGame passes names like "pics/something.pcx" or just "w_shotgun".
            // AssetManager expects specific paths usually.
            // But we can try loading as texture.

            // NOTE: CGame often registers simple names that map to paths.
            // We assume the name is a path or resolvable by AssetManager.
            if (imports.engine.assets) {
                imports.engine.assets.loadTexture(name).then(texture => {
                     // Register with renderer
                     if (imports.engine.renderer) {
                         const pic = imports.engine.renderer.registerTexture(name, texture);
                         picCache.set(name, pic);
                     }
                     pendingPics.delete(name);
                }).catch(err => {
                    console.warn(`[CGameImport] Failed to load pic: ${name}`, err);
                    pendingPics.delete(name);
                });
            }

            return name;
        },
        Draw_GetPicSize: (picHandle: unknown) => {
            const name = picHandle as string;
            const pic = picCache.get(name);
            if (pic) {
                return { width: pic.width, height: pic.height };
            }
            return { width: 0, height: 0 };
        },
        SCR_DrawChar: (x: number, y: number, char: number) => {
             // Not directly exposed, use drawString hack or expose it
             // Using single char string
             getRenderer()?.drawString(x, y, String.fromCharCode(char));
        },
        SCR_DrawPic: (x: number, y: number, picHandle: unknown) => {
            const name = picHandle as string;
            const pic = picCache.get(name);
            if (pic) {
                getRenderer()?.drawPic(x, y, pic);
            }
        },
        SCR_DrawColorPic: (x: number, y: number, picHandle: unknown, color: Vec3, alpha: number) => {
             const name = picHandle as string;
            const pic = picCache.get(name);
            if (pic) {
                getRenderer()?.drawPic(x, y, pic, [color.x, color.y, color.z, alpha]);
            }
        },
        SCR_DrawFontString: (x: number, y: number, str: string) => {
            getRenderer()?.drawString(x, y, str);
        },
        SCR_DrawCenterString: (y: number, str: string) => {
            getRenderer()?.drawCenterString(y, str);
        },
        SCR_MeasureFontString: (str: string) => {
            const stripped = str.replace(/\^[0-9]/g, '');
            return stripped.length * 8;
        },
        SCR_FontLineHeight: () => 8,
        SCR_SetAltTypeface: (alt: boolean) => {
            // Stub
        },
        SCR_DrawBind: (x: number, y: number, command: string) => {
             // Look up binding and draw
             const key = state.getKeyBinding(command); // command is actually command name, we need key?
             // Wait, SCR_DrawBind usually takes a command and finds the key bound to it.
             // We only implemented `getKeyBinding` which takes a key.
             // We need `getBindingForKey` or `getKeysForCommand`.
             // For now, draw command name
             getRenderer()?.drawString(x, y, `[${command}]`);
        },

        // Localization
        Localize: (key: string) => key,

        // State queries
        CL_GetTextInput: () => '',
        CL_GetWarnAmmoCount: () => 5,
        CL_InAutoDemoLoop: () => state.inAutoDemo,

        // Prediction Trace
        PM_Trace: (start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3): PmoveTraceResult => {
             return imports.engine.trace(start, end, mins, maxs);
        }
    };
}
