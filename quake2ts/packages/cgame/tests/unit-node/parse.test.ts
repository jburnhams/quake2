import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GetCGameAPI, CGameImport, CGameExport } from '../../src/index.js';
import { ConfigStringIndex } from '@quake2ts/shared';
import { CG_GetMessageSystem } from '../../src/screen.js';

describe('CGame Parsing', () => {
    let cg: CGameExport;
    let cgi: CGameImport;

    beforeEach(() => {
        cgi = {
            Com_Print: vi.fn(),
            RegisterModel: vi.fn(),
            RegisterSound: vi.fn(),
            Draw_RegisterPic: vi.fn(),
            CL_ClientTime: vi.fn().mockReturnValue(12345),
            // ... minimal mock for other required methods
            tick_rate: 10,
            frame_time_s: 0.1,
            frame_time_ms: 100,
            Com_Error: vi.fn(),
            get_configstring: vi.fn(),
            TagMalloc: vi.fn(),
            TagFree: vi.fn(),
            FreeTags: vi.fn(),
            cvar: vi.fn(),
            Cvar_Get: vi.fn().mockReturnValue({ value: 0 }),
            cvar_set: vi.fn(),
            cvar_forceset: vi.fn(),
            CL_FrameValid: vi.fn().mockReturnValue(true),
            CL_FrameTime: vi.fn(),
            CL_ServerFrame: vi.fn(),
            CL_ServerProtocol: vi.fn(),
            CL_GetClientName: vi.fn(),
            CL_GetClientPic: vi.fn(),
            CL_GetClientDogtag: vi.fn(),
            CL_GetKeyBinding: vi.fn(),
            Draw_GetPicSize: vi.fn().mockReturnValue({ width: 0, height: 0 }),
            SCR_DrawChar: vi.fn(),
            SCR_DrawPic: vi.fn(),
            SCR_DrawColorPic: vi.fn(),
            SCR_DrawFontString: vi.fn(),
            SCR_DrawCenterString: vi.fn(),
            SCR_MeasureFontString: vi.fn(),
            SCR_FontLineHeight: vi.fn(),
            SCR_SetAltTypeface: vi.fn(),
            SCR_DrawBind: vi.fn(),
            Localize: vi.fn(),
            CL_GetTextInput: vi.fn(),
            CL_GetWarnAmmoCount: vi.fn(),
            CL_InAutoDemoLoop: vi.fn(),
            PM_Trace: vi.fn(),
        };

        cg = GetCGameAPI(cgi);
        cg.Init();
    });

    it('should register models from config strings', () => {
        const modelName = 'models/items/armor/shard/tris.md2';
        const index = ConfigStringIndex.Models + 10;

        cg.ParseConfigString(index, modelName);

        expect(cgi.RegisterModel).toHaveBeenCalledWith(modelName);
    });

    it('should register sounds from config strings', () => {
        const soundName = 'misc/menu1.wav';
        const index = ConfigStringIndex.Sounds + 5;

        cg.ParseConfigString(index, soundName);

        expect(cgi.RegisterSound).toHaveBeenCalledWith(soundName);
    });

    it('should register images from config strings', () => {
        const imageName = 'pics/colormap.pcx';
        const index = ConfigStringIndex.Images + 2;

        cg.ParseConfigString(index, imageName);

        expect(cgi.Draw_RegisterPic).toHaveBeenCalledWith(imageName);
    });

    it('should parse center print messages', () => {
        const msg = 'You found a secret!';
        const messageSystem = CG_GetMessageSystem();
        const setCenterPrintSpy = vi.spyOn(messageSystem, 'setCenterPrint');

        cg.ParseCenterPrint(msg, 0, false);

        expect(setCenterPrintSpy).toHaveBeenCalledWith(msg, 12345);
    });

    it('should parse notify messages', () => {
        const msg = 'Player connected';
        const messageSystem = CG_GetMessageSystem();
        const addNotificationSpy = vi.spyOn(messageSystem, 'addNotification');

        cg.NotifyMessage(0, msg, false);

        expect(addNotificationSpy).toHaveBeenCalledWith(msg, false, 12345);
    });

    it('should clear notifications', () => {
        const messageSystem = CG_GetMessageSystem();
        const clearNotificationsSpy = vi.spyOn(messageSystem, 'clearNotifications');

        cg.ClearNotify(0);

        expect(clearNotificationsSpy).toHaveBeenCalled();
    });

    it('should clear center print', () => {
        const messageSystem = CG_GetMessageSystem();
        const clearCenterPrintSpy = vi.spyOn(messageSystem, 'clearCenterPrint');

        cg.ClearCenterprint(0);

        expect(clearCenterPrintSpy).toHaveBeenCalled();
    });
});
