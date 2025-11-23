import { Renderer } from '@quake2ts/engine';
import { HUD_LAYOUT } from './layout.js';

interface Message {
  text: string;
  startTime: number;
  duration: number;
}

const CENTER_PRINT_DURATION = 3000;
const NOTIFY_DURATION = 5000;
const MAX_NOTIFY_MESSAGES = 4;

export class MessageSystem {
  private centerPrintMsg: Message | null = null;
  private notifyMessages: Message[] = [];

  addCenterPrint(text: string, now: number) {
    this.centerPrintMsg = {
      text,
      startTime: now,
      duration: CENTER_PRINT_DURATION,
    };
  }

  addNotify(text: string, now: number) {
    this.notifyMessages.push({
      text,
      startTime: now,
      duration: NOTIFY_DURATION,
    });

    if (this.notifyMessages.length > MAX_NOTIFY_MESSAGES) {
      this.notifyMessages.shift();
    }
  }

  drawCenterPrint(renderer: Renderer, now: number) {
    if (!this.centerPrintMsg) return;

    // NOTE: Using a simple time check here.
    // In original Quake 2, centerprint messages persist until explicitly cleared or replaced?
    // Actually, `scr_center_time` controls it.
    // We stick to duration for now as per previous implementation logic.

    if (now > this.centerPrintMsg.startTime + this.centerPrintMsg.duration) {
      this.centerPrintMsg = null;
      return;
    }

    // Draw centered text
    // Assuming default font size is 8x8
    const width = this.centerPrintMsg.text.length * 8;
    const x = (renderer.width - width) / 2;
    const y = HUD_LAYOUT.CENTER_PRINT_Y;

    renderer.drawString(x, y, this.centerPrintMsg.text);
  }

  drawNotifications(renderer: Renderer, now: number) {
    // Remove expired messages
    while (this.notifyMessages.length > 0 && now > this.notifyMessages[0].startTime + this.notifyMessages[0].duration) {
      this.notifyMessages.shift();
    }

    let y = 10; // Start near top-left
    for (const msg of this.notifyMessages) {
      renderer.drawString(10, y, msg.text);
      y += 10; // Line height
    }
  }
}
