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

  getString(): string {
    return this.string;
  }

  get number(): number {
    return Number(this._value);
  }

  getFloat(): number {
    return this.number;
  }

  get integer(): number {
    return Math.trunc(this.number);
  }

  getInt(): number {
    return this.integer;
  }

  get boolean(): boolean {
    return Boolean(this.integer);
  }

  getBoolean(): boolean {
    return this.boolean;
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

export interface CvarInfo {
  name: string;
  value: string;
  defaultValue: string;
  flags: CvarFlags;
  description?: string;
}

export class CvarRegistry {
  private readonly cvars = new Map<string, Cvar>();
  public onCvarChange?: (name: string, value: string) => void;

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

    // Wrap the onChange handler to also trigger the registry's onCvarChange
    const originalOnChange = def.onChange;
    const wrappedOnChange: CvarChangeHandler = (cvar, prev) => {
      originalOnChange?.(cvar, prev);
      this.onCvarChange?.(cvar.name, cvar.string);
    };

    const cvar = new Cvar({ ...def, onChange: wrappedOnChange });
    this.cvars.set(def.name, cvar);
    return cvar;
  }

  get(name: string): Cvar | undefined {
    return this.cvars.get(name);
  }

  getCvar(name: string): Cvar | undefined {
    return this.get(name);
  }

  setValue(name: string, value: string): Cvar {
    const cvar = this.get(name);
    if (!cvar) {
      throw new Error(`Unknown cvar: ${name}`);
    }

    cvar.set(value);
    return cvar;
  }

  setCvar(name: string, value: string): void {
    this.setValue(name, value);
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

  listCvars(): CvarInfo[] {
    return this.list().map(cvar => ({
      name: cvar.name,
      value: cvar.string,
      defaultValue: cvar.defaultValue,
      flags: cvar.flags,
      description: cvar.description
    }));
  }
}
