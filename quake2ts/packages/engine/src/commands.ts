
export type CommandCallback = (args: string[]) => void;

export class Command {
  readonly name: string;
  readonly description?: string;
  readonly callback: CommandCallback;

  constructor(name: string, callback: CommandCallback, description?: string) {
    this.name = name;
    this.callback = callback;
    this.description = description;
  }

  execute(args: string[]): void {
    this.callback(args);
  }
}

export class CommandRegistry {
  private readonly commands = new Map<string, Command>();

  register(name: string, callback: CommandCallback, description?: string): Command {
    const command = new Command(name, callback, description);
    this.commands.set(name, command);
    return command;
  }

  get(name: string): Command | undefined {
    return this.commands.get(name);
  }

  execute(commandString: string): boolean {
    const parts = this.tokenize(commandString);
    if (parts.length === 0) {
      return false;
    }

    const name = parts[0];
    const args = parts.slice(1);

    const command = this.get(name);
    if (command) {
      command.execute(args);
      return true;
    }

    return false;
  }

  private tokenize(text: string): string[] {
    // Simple whitespace splitting for now, could handle quotes later
    return text.trim().split(/\s+/);
  }

  list(): Command[] {
    return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
