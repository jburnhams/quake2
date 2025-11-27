import { Renderer } from '@quake2ts/engine';
import { getHudLayout } from './layout.js';

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

  // Additional methods for cgame API
  setCenterPrint(text: string) {
    this.centerPrintMsg = {
      text,
      startTime: Date.now(),
      duration: CENTER_PRINT_DURATION,
    };
  }

  addNotification(text: string, is_chat: boolean) {
    this.notifyMessages.push({
      text,
      startTime: Date.now(),
      duration: NOTIFY_DURATION,
    });

    if (this.notifyMessages.length > MAX_NOTIFY_MESSAGES) {
      this.notifyMessages.shift();
    }
  }

  clearNotifications() {
    this.notifyMessages = [];
  }

  clearCenterPrint() {
    this.centerPrintMsg = null;
  }

  drawCenterPrint(renderer: Renderer, now: number, layout: ReturnType<typeof getHudLayout>) {
    if (!this.centerPrintMsg) return;

    if (now > this.centerPrintMsg.startTime + this.centerPrintMsg.duration) {
      this.centerPrintMsg = null;
      return;
    }

    // Draw centered text
    const width = this.centerPrintMsg.text.length * 8;
    // We ignore layout.CENTER_PRINT_X because drawCenterString calculates X automatically
    const y = layout.CENTER_PRINT_Y;

    renderer.drawCenterString(y, this.centerPrintMsg.text);
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
