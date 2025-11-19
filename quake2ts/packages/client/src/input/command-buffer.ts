import type { UserCommand } from '@quake2ts/shared';
import { InputController, type InputControllerOptions } from './controller.js';

export interface QueuedFrameCommands {
  readonly command: UserCommand;
  readonly console: readonly string[];
}

export class InputCommandBuffer {
  private readonly controller: InputController;
  private readonly queued: QueuedFrameCommands[] = [];

  constructor(options?: InputControllerOptions, controller = new InputController(options)) {
    this.controller = controller;
  }

  captureFrame(frameMsec: number, now?: number, serverFrame?: number): QueuedFrameCommands {
    const command = this.controller.buildCommand(frameMsec, now, serverFrame);
    const console = this.controller.consumeConsoleCommands();
    const entry: QueuedFrameCommands = { command, console };
    this.queued.push(entry);
    return entry;
  }

  consumeQueued(): readonly QueuedFrameCommands[] {
    const queued = [...this.queued];
    this.queued.length = 0;
    return queued;
  }

  getController(): InputController {
    return this.controller;
  }
}
