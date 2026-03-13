import { vi } from 'vitest';

export function createMockCGameAPI(): any {
    return {
        Init: vi.fn(),
        Shutdown: vi.fn(),
        DrawHUD: vi.fn(),
        ParseCenterPrint: vi.fn(),
        NotifyMessage: vi.fn(),
        ParseConfigString: vi.fn(),
        ShowSubtitle: vi.fn()
    };
}

export function createMockHudImports(): any {
    return {
        Init_Hud: vi.fn().mockResolvedValue(undefined),
        Draw_Hud: vi.fn()
    };
}

export function createMockClientPrediction(): any {
    return {
        setAuthoritative: vi.fn(),
        enqueueCommand: vi.fn(),
        getPredictedState: vi.fn(),
        decayError: vi.fn()
    };
}

export function createMockViewEffects(): any {
    return {
        sample: vi.fn()
    };
}
