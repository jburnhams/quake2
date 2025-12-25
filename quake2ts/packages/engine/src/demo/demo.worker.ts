import { NetworkMessageParser, NetworkMessageHandler, FrameData, EntityState, ProtocolPlayerState, DamageIndicator, FogData, PROTOCOL_VERSION_RERELEASE } from './parser.js';
import { BinaryStream, Vec3 } from '@quake2ts/shared';

// Define the messages that can be sent to the worker
export type DemoWorkerRequest = {
  type: 'parse';
  buffer: ArrayBuffer;
  protocolVersion?: number;
};

// Define the messages that the worker sends back
export type DemoWorkerResponse =
  | { type: 'serverData'; protocol: number; serverCount: number; attractLoop: number; gameDir: string; playerNum: number; levelName: string; tickRate?: number; demoType?: number }
  | { type: 'configString'; index: number; str: string }
  | { type: 'spawnBaseline'; entity: EntityState }
  | { type: 'frame'; frame: FrameData }
  | { type: 'centerPrint'; msg: string }
  | { type: 'stuffText'; msg: string }
  | { type: 'print'; level: number; msg: string }
  | { type: 'sound'; flags: number; soundNum: number; volume?: number; attenuation?: number; offset?: number; ent?: number; pos?: Vec3 }
  | { type: 'tempEntity'; typeId: number; pos: Vec3; pos2?: Vec3; dir?: Vec3; cnt?: number; color?: number; ent?: number; srcEnt?: number; destEnt?: number }
  | { type: 'layout'; layout: string }
  | { type: 'inventory'; inventory: number[] }
  | { type: 'muzzleFlash'; ent: number; weapon: number }
  | { type: 'muzzleFlash2'; ent: number; weapon: number }
  | { type: 'disconnect' }
  | { type: 'reconnect' }
  | { type: 'download'; size: number; percent: number; data?: Uint8Array }
  | { type: 'splitClient'; clientNum: number }
  | { type: 'levelRestart' }
  | { type: 'damage'; indicators: DamageIndicator[] }
  | { type: 'locPrint'; flags: number; base: string; args: string[] }
  | { type: 'fog'; data: FogData }
  | { type: 'waitingForPlayers'; count: number }
  | { type: 'botChat'; msg: string }
  | { type: 'poi'; flags: number; pos: Vec3 }
  | { type: 'helpPath'; pos: Vec3 }
  | { type: 'muzzleFlash3'; ent: number; weapon: number }
  | { type: 'achievement'; id: string }
  | { type: 'progress'; percent: number }
  | { type: 'complete' }
  | { type: 'error'; message: string };

const ctx: Worker = self as any;

class WorkerMessageHandler implements NetworkMessageHandler {
  onServerData(protocol: number, serverCount: number, attractLoop: number, gameDir: string, playerNum: number, levelName: string, tickRate?: number, demoType?: number): void {
    ctx.postMessage({ type: 'serverData', protocol, serverCount, attractLoop, gameDir, playerNum, levelName, tickRate, demoType });
  }
  onConfigString(index: number, str: string): void {
    ctx.postMessage({ type: 'configString', index, str });
  }
  onSpawnBaseline(entity: EntityState): void {
    ctx.postMessage({ type: 'spawnBaseline', entity });
  }
  onFrame(frame: FrameData): void {
    // We can't transfer complex objects with methods, but FrameData seems to be pure data.
    // However, Uint8Array in areaBits might be transferable if we wanted to optimization,
    // but here we just post it.
    ctx.postMessage({ type: 'frame', frame });
  }
  onCenterPrint(msg: string): void {
    ctx.postMessage({ type: 'centerPrint', msg });
  }
  onStuffText(msg: string): void {
    ctx.postMessage({ type: 'stuffText', msg });
  }
  onPrint(level: number, msg: string): void {
    ctx.postMessage({ type: 'print', level, msg });
  }
  onSound(flags: number, soundNum: number, volume?: number, attenuation?: number, offset?: number, ent?: number, pos?: Vec3): void {
    ctx.postMessage({ type: 'sound', flags, soundNum, volume, attenuation, offset, ent, pos });
  }
  onTempEntity(type: number, pos: Vec3, pos2?: Vec3, dir?: Vec3, cnt?: number, color?: number, ent?: number, srcEnt?: number, destEnt?: number): void {
    ctx.postMessage({ type: 'tempEntity', typeId: type, pos, pos2, dir, cnt, color, ent, srcEnt, destEnt });
  }
  onLayout(layout: string): void {
    ctx.postMessage({ type: 'layout', layout });
  }
  onInventory(inventory: number[]): void {
    ctx.postMessage({ type: 'inventory', inventory });
  }
  onMuzzleFlash(ent: number, weapon: number): void {
    ctx.postMessage({ type: 'muzzleFlash', ent, weapon });
  }
  onMuzzleFlash2(ent: number, weapon: number): void {
    ctx.postMessage({ type: 'muzzleFlash2', ent, weapon });
  }
  onDisconnect(): void {
    ctx.postMessage({ type: 'disconnect' });
  }
  onReconnect(): void {
    ctx.postMessage({ type: 'reconnect' });
  }
  onDownload(size: number, percent: number, data?: Uint8Array): void {
    ctx.postMessage({ type: 'download', size, percent, data });
  }
  onSplitClient(clientNum: number): void {
    ctx.postMessage({ type: 'splitClient', clientNum });
  }
  onLevelRestart(): void {
    ctx.postMessage({ type: 'levelRestart' });
  }
  onDamage(indicators: DamageIndicator[]): void {
    ctx.postMessage({ type: 'damage', indicators });
  }
  onLocPrint(flags: number, base: string, args: string[]): void {
    ctx.postMessage({ type: 'locPrint', flags, base, args });
  }
  onFog(data: FogData): void {
    ctx.postMessage({ type: 'fog', data });
  }
  onWaitingForPlayers(count: number): void {
    ctx.postMessage({ type: 'waitingForPlayers', count });
  }
  onBotChat(msg: string): void {
    ctx.postMessage({ type: 'botChat', msg });
  }
  onPoi(flags: number, pos: Vec3): void {
    ctx.postMessage({ type: 'poi', flags, pos });
  }
  onHelpPath(pos: Vec3): void {
    ctx.postMessage({ type: 'helpPath', pos });
  }
  onMuzzleFlash3(ent: number, weapon: number): void {
    ctx.postMessage({ type: 'muzzleFlash3', ent, weapon });
  }
  onAchievement(id: string): void {
    ctx.postMessage({ type: 'achievement', id });
  }
}

ctx.onmessage = async (event: MessageEvent<DemoWorkerRequest>) => {
  const { type, buffer, protocolVersion } = event.data;

  if (type === 'parse') {
    try {
      const stream = new BinaryStream(buffer);
      const handler = new WorkerMessageHandler();
      const parser = new NetworkMessageParser(stream, handler, false);

      if (protocolVersion) {
        parser.setProtocolVersion(protocolVersion);
      }

      const totalBytes = stream.getLength();
      let lastProgressTime = 0;

      while (stream.hasMore()) {
         parser.parseMessage();

         const now = Date.now();
         if (now - lastProgressTime > 100) { // Update every 100ms
            const percent = stream.getReadPosition() / totalBytes;
            ctx.postMessage({ type: 'progress', percent });
            lastProgressTime = now;
         }
      }

      ctx.postMessage({ type: 'progress', percent: 1.0 });
      ctx.postMessage({ type: 'complete' });
    } catch (e) {
      ctx.postMessage({ type: 'error', message: (e as Error).message });
    }
  }
};
