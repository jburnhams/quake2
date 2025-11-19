import { CvarFlags } from '@quake2ts/shared';

export type CvarChangeHandler = (cvar: Cvar, previousValue: string) => void;

export class Cvar {
  readonly name: string;
  readonly defaultValue: string;
  readonly description?: string;
  readonly flags: CvarFlags;
  private _value: string;
  private latched?: string;
  private onChange?: CvarChangeHandler;
  modifiedCount = 0;

  constructor({
    name,
    defaultValue,
    description,
    flags = CvarFlags.None,
    onChange,
  }: {
    name: string;
    defaultValue: string;
    description?: string;
    flags?: CvarFlags;
    onChange?: CvarChangeHandler;
  }) {
    this.name = name;
    this.defaultValue = defaultValue;
    this.description = description;
    this.flags = flags;
    this._value = defaultValue;
    this.onChange = onChange;
  }

  get string(): string {
    return this._value;
  }

  get number(): number {
    return Number(this._value);
  }

  get integer(): number {
    return Math.trunc(this.number);
  }

  get boolean(): boolean {
    return Boolean(this.integer);
  }

  set(value: string): void {
    if (this.flags & CvarFlags.Latch) {
      if (value === this._value) {
        this.latched = undefined;
        return;
      }

      if (this.latched === value) {
        return;
      }

      if (this.latched !== value) {
        this.latched = value;
      }
      return;
    }

    this.apply(value);
  }

  reset(): void {
    this.latched = undefined;
    this.apply(this.defaultValue);
  }

  applyLatched(): boolean {
    if (this.latched === undefined) {
      return false;
    }

    const pending = this.latched;
    this.latched = undefined;
    if (pending === this._value) {
      return false;
    }
    this.apply(pending);
    return true;
  }

  private apply(next: string): void {
    if (this._value === next) {
      return;
    }

    const previous = this._value;
    this._value = next;
    this.modifiedCount += 1;
    this.onChange?.(this, previous);
  }
}

export class CvarRegistry {
  private readonly cvars = new Map<string, Cvar>();

  register(def: {
    name: string;
    defaultValue: string;
    description?: string;
    flags?: CvarFlags;
    onChange?: CvarChangeHandler;
  }): Cvar {
    const existing = this.cvars.get(def.name);
    if (existing) {
      return existing;
    }

    const cvar = new Cvar(def);
    this.cvars.set(def.name, cvar);
    return cvar;
  }

  get(name: string): Cvar | undefined {
    return this.cvars.get(name);
  }

  setValue(name: string, value: string): Cvar {
    const cvar = this.get(name);
    if (!cvar) {
      throw new Error(`Unknown cvar: ${name}`);
    }

    cvar.set(value);
    return cvar;
  }

  resetAll(): void {
    for (const cvar of this.cvars.values()) {
      cvar.reset();
    }
  }

  applyLatched(): boolean {
    let changed = false;
    for (const cvar of this.cvars.values()) {
      changed = cvar.applyLatched() || changed;
    }
    return changed;
  }

  list(): Cvar[] {
    return [...this.cvars.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
}
