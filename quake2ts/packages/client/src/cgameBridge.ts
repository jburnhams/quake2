import { CGameImport, CGameExport } from '@quake2ts/cgame';
import { ClientImports } from './index.js';
import { PmoveTraceResult, Vec3 } from '@quake2ts/shared';

// Stub implementation of CGameImport using existing client/engine state
export function createCGameImport(imports: ClientImports): CGameImport {
    // Helper to access renderer safely
    const getRenderer = () => imports.engine.renderer;

    // Helper to access optional components that might not be on ClientImports directly yet
    // depending on how index.ts constructs things.
    // In index.ts:
    // const clientExports = { ... }
    // return clientExports;
    //
    // However, imports passed to createClient only has `engine` and `host`.
    // The `client` instance (ClientExports) holds `lastRendered`, `configStrings`, etc.
    // We need access to the *client instance* or the state it holds.
    // But `createCGameImport` is called *during* `createClient`.
    // So we need a way to look up the state lazily or pass a state accessor.

    // Solution: We'll attach a reference to the client exports *after* creation,
    // or use a closure that can access the variables inside `createClient`.
    // BUT `createCGameImport` is external.

    // Let's modify the signature to accept a context getter.
    // For now, we will assume `imports` is extended OR we accept getters.

    // Actually, `createClient` has local variables `lastRendered`, `configStrings`.
    // We can't access them from `imports`.
    // We should change `createCGameImport` to accept a `ClientStateProvider`.
    return {
        // Frame timing - stubbed for now until we fix the access pattern
        get tick_rate() { return 10; },
        get frame_time_s() { return 0; },
        get frame_time_ms() { return 0; },

        // Console
        Com_Print: (msg: string) => {
            console.log(`[CGAME] ${msg}`);
        },
        Com_Error: (msg: string) => {
            console.error(`[CGAME ERROR] ${msg}`);
        },

        // Config strings
        get_configstring: (num: number) => {
            return ''; // Stub
        },

        // Memory (No-op in JS)
        TagMalloc: (size: number, tag: number) => ({}),
        TagFree: (ptr: unknown) => {},
        FreeTags: (tag: number) => {},

        // Cvars
        cvar: (name: string, value: string, flags: number) => {
            // Register if not exists?
            // For now, return a handle or null
            return null;
        },
        cvar_set: (name: string, value: string) => {
            if (imports.host?.cvars) {
                imports.host.cvars.setValue(name, value);
            }
        },
        cvar_forceset: (name: string, value: string) => {
            if (imports.host?.cvars) {
                // TODO: Force set ignoring flags
                imports.host.cvars.setValue(name, value);
            }
        },

        // Client state
        CL_FrameValid: () => true,
        CL_FrameTime: () => 0,
        CL_ClientTime: () => 0,
        CL_ServerFrame: () => 0,
        CL_ServerProtocol: () => 34,

        // Client info
        CL_GetClientName: (playerNum: number) => {
            // TODO: Parse CS_PLAYERS
            return `Player ${playerNum}`;
        },
        CL_GetClientPic: (playerNum: number) => {
            // TODO: Parse CS_PLAYERS for skin/icon
            return '';
        },
        CL_GetClientDogtag: (playerNum: number) => {
             return '';
        },
        CL_GetKeyBinding: (key: string) => {
            // TODO: Access InputBindings
            return `[${key}]`;
        },

        // Drawing
        Draw_RegisterPic: (name: string) => {
            // This is async in our engine :(
            // But cgame expects synchronous handle?
            // Or maybe it triggers load and returns handle that is ready later.
            // Our renderer uses `Pic` (Texture2D).
            // We'll return a placeholder string or object for now if needed,
            // but ideally we should trigger the load.
            if (imports.engine.assets) {
                // If it's a texture path
                // We assume it's preloaded or we trigger load.
                // The renderer.registerPic is async.
                // We might need to verify how CGame uses the result.
                // It likely passes it back to SCR_DrawPic.
                // So we can return the name string as the handle.
                return name;
            }
            return name;
        },
        Draw_GetPicSize: (pic: unknown) => {
            // 'pic' is likely the name string we returned above.
            // We need to look it up in renderer cache or asset manager.
            // This is hard without direct access to internal cache.
            // However, `renderer.registerPic` might have cached it.
            // NOTE: This might be a blocker if CGame logic depends on size immediately.
            // For now, return stub.
            return { width: 32, height: 32 };
        },
        SCR_DrawChar: (x: number, y: number, char: number) => {
             // Not exposed directly in Renderer interface, but `drawString` uses it internally.
             // We can use drawString for a single char if needed, or expose drawChar in Renderer.
             // Using drawString for now.
             getRenderer()?.drawString(x, y, String.fromCharCode(char));
        },
        SCR_DrawPic: (x: number, y: number, pic: unknown) => {
            const name = pic as string;
            // We need the Pic object.
            // The renderer has `drawPic` taking `Pic`.
            // But `picCache` is private in `createRenderer`.
            // However, `registerPic` returns the Pic.
            // If we didn't store it, we can't get it.
            // TODO: Fix this architectural mismatch.
            // For now, we assume `pic` IS the `Pic` object if we could pass it,
            // but we returned a string name above.
            //
            // Hack: If we cannot get the Pic object synchronously, we can't draw immediately.
            // BUT: `registerPic` in renderer returns `Promise<Pic>`.
            // `Init` in client does `Init_Hud` which handles loading.
            // CGame `TouchPics` calls `Draw_RegisterPic`.
            //
            // We might need to change `Draw_RegisterPic` to return `Promise` or handle async loading
            // within CGame, OR maintain a map here in the bridge.
        },
        SCR_DrawColorPic: (x: number, y: number, pic: unknown, color: Vec3, alpha: number) => {
             // Stub
        },
        SCR_DrawFontString: (x: number, y: number, str: string) => {
            getRenderer()?.drawString(x, y, str);
        },
        SCR_DrawCenterString: (y: number, str: string) => {
            getRenderer()?.drawCenterString(y, str);
        },
        SCR_MeasureFontString: (str: string) => {
            // Assuming 8x8 chars
            const stripped = str.replace(/\^[0-9]/g, '');
            return stripped.length * 8;
        },
        SCR_FontLineHeight: () => 8,
        SCR_SetAltTypeface: (alt: boolean) => {
            // Stub
        },
        SCR_DrawBind: (x: number, y: number, command: string) => {
            // Stub - normally looks up key binding and draws text
            getRenderer()?.drawString(x, y, `[${command}]`);
        },

        // Localization
        Localize: (key: string) => key,

        // State queries
        CL_GetTextInput: () => '',
        CL_GetWarnAmmoCount: () => 5, // Low ammo threshold
        CL_InAutoDemoLoop: () => false,

        // Prediction Trace
        PM_Trace: (start: Vec3, end: Vec3, mins: Vec3, maxs: Vec3): PmoveTraceResult => {
             // Call engine trace
             // Engine trace signature: (start, end, mins, maxs) -> TraceResult
             return imports.engine.trace(start, end);
        }
    };
}
