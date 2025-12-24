import { NetworkMessageHandler, FrameData, EntityState, ProtocolPlayerState, DamageIndicator, FogData } from './parser.js';
import { Vec3 } from '@quake2ts/shared';
import type { DemoWorkerResponse } from './demo.worker.js';

export interface AsyncDemoParserOptions {
  onProgress?: (progress: number) => void;
  protocolVersion?: number;
}

export class AsyncDemoParser {
  private worker: Worker;
  private handler: NetworkMessageHandler;

  constructor(handler: NetworkMessageHandler) {
    this.handler = handler;
    // Assume the worker is built alongside the application and available
    // For a library, this path resolution can be tricky.
    // We'll rely on the bundler to handle the import via 'new URL'.
    this.worker = new Worker(new URL('./demo.worker.ts', import.meta.url), { type: 'module' });
  }

  public parse(buffer: ArrayBuffer, options: AsyncDemoParserOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      const { protocolVersion } = options;

      const onComplete = (e: MessageEvent) => {
        const data = e.data as DemoWorkerResponse;
        if (data.type === 'complete') {
          cleanup();
          resolve();
        } else if (data.type === 'error') {
          cleanup();
          reject(new Error(data.message));
        }
      };

      const onError = (e: ErrorEvent) => {
        cleanup();
        reject(new Error(`Worker error: ${e.message}`));
      };

      const cleanup = () => {
        this.worker.removeEventListener('message', onComplete);
        this.worker.removeEventListener('error', onError);
        // We also need to remove the message listener that handles data
        this.worker.removeEventListener('message', this.boundHandleMessage);
      };

      // Store bound function to remove it later
      this.boundHandleMessage = this.handleMessage.bind(this);

      this.worker.addEventListener('message', onComplete);
      this.worker.addEventListener('error', onError);
      this.worker.addEventListener('message', this.boundHandleMessage);

      this.worker.postMessage({
        type: 'parse',
        buffer,
        protocolVersion
      }, [buffer]); // Transfer buffer ownership
    });
  }

  private boundHandleMessage!: (event: MessageEvent<DemoWorkerResponse>) => void;

  private handleMessage(event: MessageEvent<DemoWorkerResponse>): void {
    const data = event.data;
    switch (data.type) {
      case 'serverData':
        this.handler.onServerData(data.protocol, data.serverCount, data.attractLoop, data.gameDir, data.playerNum, data.levelName, data.tickRate, data.demoType);
        break;
      case 'configString':
        this.handler.onConfigString(data.index, data.str);
        break;
      case 'spawnBaseline':
        this.handler.onSpawnBaseline(data.entity);
        break;
      case 'frame':
        this.handler.onFrame(data.frame);
        break;
      case 'centerPrint':
        this.handler.onCenterPrint(data.msg);
        break;
      case 'stuffText':
        this.handler.onStuffText(data.msg);
        break;
      case 'print':
        this.handler.onPrint(data.level, data.msg);
        break;
      case 'sound':
        this.handler.onSound(data.flags, data.soundNum, data.volume, data.attenuation, data.offset, data.ent, data.pos);
        break;
      case 'tempEntity':
        this.handler.onTempEntity(data.typeId, data.pos, data.pos2, data.dir, data.cnt, data.color, data.ent, data.srcEnt, data.destEnt);
        break;
      case 'layout':
        this.handler.onLayout(data.layout);
        break;
      case 'inventory':
        this.handler.onInventory(data.inventory);
        break;
      case 'muzzleFlash':
        this.handler.onMuzzleFlash(data.ent, data.weapon);
        break;
      case 'muzzleFlash2':
        this.handler.onMuzzleFlash2(data.ent, data.weapon);
        break;
      case 'disconnect':
        this.handler.onDisconnect();
        break;
      case 'reconnect':
        this.handler.onReconnect();
        break;
      case 'download':
        this.handler.onDownload(data.size, data.percent, data.data);
        break;
      case 'splitClient':
        if (this.handler.onSplitClient) this.handler.onSplitClient(data.clientNum);
        break;
      case 'levelRestart':
        if (this.handler.onLevelRestart) this.handler.onLevelRestart();
        break;
      case 'damage':
        if (this.handler.onDamage) this.handler.onDamage(data.indicators);
        break;
      case 'locPrint':
        if (this.handler.onLocPrint) this.handler.onLocPrint(data.flags, data.base, data.args);
        break;
      case 'fog':
        if (this.handler.onFog) this.handler.onFog(data.data);
        break;
      case 'waitingForPlayers':
        if (this.handler.onWaitingForPlayers) this.handler.onWaitingForPlayers(data.count);
        break;
      case 'botChat':
        if (this.handler.onBotChat) this.handler.onBotChat(data.msg);
        break;
      case 'poi':
        if (this.handler.onPoi) this.handler.onPoi(data.flags, data.pos);
        break;
      case 'helpPath':
        if (this.handler.onHelpPath) this.handler.onHelpPath(data.pos);
        break;
      case 'muzzleFlash3':
        if (this.handler.onMuzzleFlash3) this.handler.onMuzzleFlash3(data.ent, data.weapon);
        break;
      case 'achievement':
        if (this.handler.onAchievement) this.handler.onAchievement(data.id);
        break;
    }
  }

  public terminate(): void {
    this.worker.terminate();
  }
}
