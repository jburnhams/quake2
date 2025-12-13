import { WebSocketServer } from 'ws';
import { WebSocketNetDriver } from '../net/nodeWsDriver.js';
import { NetworkTransport } from '../transport.js';
import { NetDriver } from '@quake2ts/shared';

export class WebSocketTransport implements NetworkTransport {
    private wss: WebSocketServer | null = null;
    private connectionCallback: ((driver: NetDriver, info?: any) => void) | null = null;
    private errorCallback: ((error: Error) => void) | null = null;

    async listen(port: number): Promise<void> {
        return new Promise((resolve) => {
            this.wss = new WebSocketServer({ port });
            this.wss.on('listening', () => resolve());
            this.wss.on('connection', (ws, req) => {
                const driver = new WebSocketNetDriver();
                driver.attach(ws);
                if (this.connectionCallback) {
                    this.connectionCallback(driver, req);
                }
            });
            this.wss.on('error', (err) => {
                if (this.errorCallback) this.errorCallback(err);
            });
        });
    }

    close() {
        if (this.wss) {
            this.wss.close();
            this.wss = null;
        }
    }

    onConnection(callback: (driver: NetDriver, info?: any) => void) {
        this.connectionCallback = callback;
    }

    onError(callback: (error: Error) => void) {
        this.errorCallback = callback;
    }
}
