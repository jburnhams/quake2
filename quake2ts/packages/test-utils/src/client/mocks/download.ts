import { vi } from 'vitest';

export interface DownloadManager {
    download(url: string): Promise<ArrayBuffer>;
    cancel(url: string): void;
    getProgress(url: string): number;
}

export function createMockDownloadManager(overrides?: Partial<DownloadManager>): DownloadManager {
    return {
        download: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
        cancel: vi.fn(),
        getProgress: vi.fn().mockReturnValue(0),
        ...overrides
    };
}

export interface PrecacheList {
    models: string[];
    sounds: string[];
    images: string[];
}

export function createMockPrecacheList(
    models: string[] = [],
    sounds: string[] = [],
    images: string[] = []
): PrecacheList {
    return {
        models,
        sounds,
        images
    };
}

export async function simulateDownload(
    url: string,
    progressCallback?: (percent: number) => void
): Promise<ArrayBuffer> {
    const steps = 10;
    for (let i = 0; i <= steps; i++) {
        if (progressCallback) {
            progressCallback(i / steps);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    return new ArrayBuffer(1024);
}
