import { NetDriver } from '@quake2ts/shared';

export interface NetworkTransport {
    listen(port: number): Promise<void>;
    close(): void;
    onConnection(callback: (driver: NetDriver, info?: any) => void): void;
    onError(callback: (error: Error) => void): void;
}
