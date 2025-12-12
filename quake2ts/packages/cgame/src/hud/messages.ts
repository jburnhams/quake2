import type { CGameImport } from '../types.js';
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
  setCenterPrint(text: string, now: number) {
    this.centerPrintMsg = {
      text,
      startTime: now,
      duration: CENTER_PRINT_DURATION,
    };
  }

  addNotification(text: string, is_chat: boolean, now: number) {
    this.notifyMessages.push({
      text,
      startTime: now,
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

  drawCenterPrint(cgi: CGameImport, now: number, layout: ReturnType<typeof getHudLayout>) {
    if (!this.centerPrintMsg) return;

    if (now > this.centerPrintMsg.startTime + this.centerPrintMsg.duration) {
      this.centerPrintMsg = null;
      return;
    }

    // Draw centered text
    const y = layout.CENTER_PRINT_Y;

    cgi.SCR_DrawCenterString(y, this.centerPrintMsg.text);
  }

  drawNotifications(cgi: CGameImport, now: number) {
    // Remove expired messages
    while (this.notifyMessages.length > 0 && now > this.notifyMessages[0].startTime + this.notifyMessages[0].duration) {
      this.notifyMessages.shift();
    }

    let y = 10; // Start near top-left
    for (const msg of this.notifyMessages) {
      cgi.SCR_DrawFontString(10, y, msg.text); // Use SCR_DrawFontString instead of drawString
      y += 10; // Line height - TODO: use cgi.SCR_FontLineHeight()
    }
  }
}
