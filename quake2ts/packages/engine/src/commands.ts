
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
  public onConsoleOutput?: (message: string) => void;

  register(name: string, callback: CommandCallback, description?: string): Command {
    const command = new Command(name, callback, description);
    this.commands.set(name, command);
    return command;
  }

  registerCommand(name: string, callback: CommandCallback): void {
    this.register(name, callback);
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

    this.onConsoleOutput?.(`Unknown command "${name}"`);
    return false;
  }

  executeCommand(cmd: string): void {
    this.execute(cmd);
  }

  private tokenize(text: string): string[] {
    const args: string[] = [];
    let currentArg = '';
    let inQuote = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === ' ' && !inQuote) {
        if (currentArg.length > 0) {
          args.push(currentArg);
          currentArg = '';
        }
      } else {
        currentArg += char;
      }
    }
    if (currentArg.length > 0) {
      args.push(currentArg);
    }

    return args;
  }

  list(): Command[] {
    return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
