import { vi } from 'vitest';

export class MockClientPrediction {
    constructor() {
        return {
            setAuthoritative: vi.fn(),
            getPredictedState: vi.fn(),
            enqueueCommand: vi.fn(),
            decayError: vi.fn()
        };
    }
}

export class MockViewEffects {
    constructor() {
        return {
            render: vi.fn(),
            update: vi.fn(),
            sample: vi.fn() // Added sample
        };
    }
}

export class MockDemoPlaybackController {
    constructor() {
        return {
            setHandler: vi.fn(),
            setFrameDuration: vi.fn(),
            getCurrentTime: vi.fn(() => 0),
            update: vi.fn(),
            loadDemo: vi.fn(),
            stop: vi.fn(),
            setSpeed: vi.fn(),
            getDuration: vi.fn().mockReturnValue(100),
            getState: vi.fn(),
            getSpeed: vi.fn().mockReturnValue(1),
            getPlaybackSpeed: vi.fn().mockReturnValue(1),
            getInterpolationFactor: vi.fn().mockReturnValue(0),
            play: vi.fn(),
            pause: vi.fn(),
            stepForward: vi.fn(),
            stepBackward: vi.fn(),
            seek: vi.fn(),
            getCurrentFrame: vi.fn().mockReturnValue(0),
            getTotalFrames: vi.fn().mockReturnValue(100)
        };
    }
}

export class MockDynamicLightManager {
    constructor() {
        return {
            update: vi.fn(),
            getActiveLights: vi.fn(() => [])
        };
    }
}

export class MockDemoRecorder {
    constructor() {
        return {
            startRecording: vi.fn(),
            stopRecording: vi.fn(),
            getIsRecording: vi.fn(() => false)
        };
    }
}

export class MockClientNetworkHandler {
    constructor() {
        return {
            setView: vi.fn(),
            setCallbacks: vi.fn(),
            entities: new Map(),
            getPredictionState: vi.fn().mockReturnValue({
                 origin: { x: 0, y: 0, z: 0 },
                 velocity: { x: 0, y: 0, z: 0 },
                 viewAngles: { x: 0, y: 0, z: 0 },
                 pmFlags: 0,
                 fov: 90,
                 client: {}
            }),
            getRenderableEntities: vi.fn(() => []),
            getDemoCamera: vi.fn().mockReturnValue({
                 origin: { x: 0, y: 0, z: 0 },
                 angles: { x: 0, y: 0, z: 0 },
                 fov: 90
            }),
            latestFrame: undefined,
            latestServerFrame: 100,
            playerNum: 0
        };
    }
}

export class MockMenuSystem {
    constructor() {
        return {
            onStateChange: undefined,
            isActive: vi.fn(() => false),
            closeAll: vi.fn(),
            pushMenu: vi.fn(),
            handleInput: vi.fn(),
            getState: vi.fn(() => ({ activeMenu: null })),
            render: vi.fn() // Added render
        };
    }
}
