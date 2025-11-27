import { describe, it, expect, vi } from 'vitest';
import { GetCGameAPI } from '../src/index.js';
import { CGameImport } from '../src/types.js';

describe('CGame Entry Point', () => {
  const mockImport: CGameImport = {
    tick_rate: 10,
    frame_time_s: 0.1,
    frame_time_ms: 100,
    Com_Print: vi.fn(),
    Com_Error: vi.fn(),
    get_configstring: vi.fn(),
    TagMalloc: vi.fn(),
    TagFree: vi.fn(),
    FreeTags: vi.fn(),
    cvar: vi.fn(),
    cvar_set: vi.fn(),
    cvar_forceset: vi.fn(),
    CL_FrameValid: vi.fn(),
    CL_FrameTime: vi.fn(),
    CL_ClientTime: vi.fn(),
    CL_ServerFrame: vi.fn(),
    CL_ServerProtocol: vi.fn(),
    CL_GetClientName: vi.fn(),
    CL_GetClientPic: vi.fn(),
    CL_GetClientDogtag: vi.fn(),
    CL_GetKeyBinding: vi.fn(),
    Draw_RegisterPic: vi.fn(),
    Draw_GetPicSize: vi.fn(),
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

  it('should export GetCGameAPI function', () => {
    expect(typeof GetCGameAPI).toBe('function');
  });

  it('should return an API object', () => {
    const api = GetCGameAPI(mockImport);
    expect(api).toBeDefined();
    expect(typeof api).toBe('object');
  });
});
