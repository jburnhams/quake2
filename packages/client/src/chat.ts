export interface ChatMessage {
  timestamp: number;
  sender?: string; // If undefined, it's a system message
  text: string;
  team: boolean;
}

export class ChatManager {
  private history: ChatMessage[] = [];
  private maxHistory = 100;
  private listeners: ((sender: string, message: string, team: boolean) => void)[] = [];
  private sendCommand: (cmd: string) => void;

  constructor(sendCommand: (cmd: string) => void) {
    this.sendCommand = sendCommand;
  }

  public addListener(listener: (sender: string, message: string, team: boolean) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (sender: string, message: string, team: boolean) => void) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  public sendChatMessage(message: string, team: boolean = false) {
    // Escape quotes and backslashes to prevent command injection
    const escaped = message.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const cmd = team ? `say_team "${escaped}"` : `say "${escaped}"`;
    this.sendCommand(cmd);
  }

  public addMessage(level: number, text: string) {
    // Parse chat vs system message
    // Q2 Chat format: "Name: message"
    // Team Chat: "(Name): message" (Standard Q2 team chat format is often just Name: but sent to team only,
    // or (Name): ... depending on mod. Vanilla Q2 uses (Name): for team chat I believe.)

    // However, the `text` received in `onPrint` might be raw text.
    // We need to heuristic parsing.

    let sender: string | undefined;
    let content = text;
    let team = false;

    // Check for standard chat pattern "Name: message"
    // Be careful of system messages that might contain colon.
    // Names in Q2 can contain almost anything except quotes maybe?
    // And usually they don't contain newlines.

    // Regex for "Name: message"
    // We assume name is at start of string.
    const match = text.match(/^([^:]+):\s(.*)$/);
    const teamMatch = text.match(/^\(([^)]+)\):\s(.*)$/);

    if (teamMatch) {
        sender = teamMatch[1];
        content = teamMatch[2];
        team = true;
    } else if (match) {
        sender = match[1];
        content = match[2];
        team = false;
    }

    // Filter out common system messages that might look like chat?
    // "print" messages.
    // e.g. "Connection accepted."

    const message: ChatMessage = {
        timestamp: Date.now(),
        sender,
        text: content,
        team
    };

    this.history.push(message);
    if (this.history.length > this.maxHistory) {
        this.history.shift();
    }

    if (sender) {
        this.notifyListeners(sender, content, team);
    }
  }

  public getHistory(): ChatMessage[] {
      return [...this.history];
  }

  private notifyListeners(sender: string, message: string, team: boolean) {
      for (const listener of this.listeners) {
          listener(sender, message, team);
      }
  }
}
