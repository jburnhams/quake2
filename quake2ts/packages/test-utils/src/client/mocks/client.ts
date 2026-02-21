import { vi } from 'vitest';

export function createMockCGameAPI() {
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

export const MockClientPrediction = class {
    constructor() {
        return {
            setAuthoritative: vi.fn(),
            getPredictedState: vi.fn(),
            enqueueCommand: vi.fn(),
            decayError: vi.fn()
        };
    }
};

export const MockViewEffects = class {
    constructor() {
        return {
            render: vi.fn(),
            update: vi.fn()
        };
    }
};

export const MockEngineHost = class { constructor() {} };

export const MockDemoPlaybackController = class {
    constructor() {
        return {
            setHandler: vi.fn(),
            setFrameDuration: vi.fn(),
            getCurrentTime: vi.fn(() => 0),
            update: vi.fn(),
            loadDemo: vi.fn()
        };
    }
};

export const MockRenderer = class { constructor() {} };

export const MockDynamicLightManager = class {
    constructor() {
        return {
            update: vi.fn(),
            getActiveLights: vi.fn(() => [])
        };
    }
};

export const MockDemoRecorder = class {
    constructor() {
        return {
            startRecording: vi.fn(),
            stopRecording: vi.fn(),
            getIsRecording: vi.fn(() => false)
        };
    }
};

export const MockClientNetworkHandler = class {
    constructor() {
        return {
            setView: vi.fn(),
            setCallbacks: vi.fn()
        };
    }
};

export const MockMenuSystem = class {
    constructor() {
        return {
            onStateChange: undefined,
            isActive: vi.fn(() => false),
            closeAll: vi.fn(),
            pushMenu: vi.fn(),
            handleInput: vi.fn()
        };
    }
};

export const mockCreateEmptyEntityState = vi.fn(() => ({ origin: { x: 0, y: 0, z: 0 } }));
