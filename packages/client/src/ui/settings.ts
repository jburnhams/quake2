import { CvarFlags } from '@quake2ts/shared';

export interface SettingsStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export class BrowserSettings {
  constructor(private readonly storage: SettingsStorage) {}

  loadCvars(cvars: Map<string, { value: string, setValue: (v: string) => void }>) {
      try {
          const stored = this.storage.getItem('quake2ts_cvars');
          if (stored) {
              const data = JSON.parse(stored) as Record<string, string>;
              for (const [key, value] of Object.entries(data)) {
                  // Only update if cvar exists
                  const cvar = cvars.get(key);
                  if (cvar) {
                      cvar.setValue(value);
                  }
              }
          }
      } catch (e) {
          console.warn('Failed to load settings', e);
      }
  }

  saveCvars(cvars: { name: string, value: string, flags: number }[]) {
      const data: Record<string, string> = {};
      for (const cvar of cvars) {
          if (cvar.flags & CvarFlags.Archive) {
              data[cvar.name] = cvar.value;
          }
      }
      try {
          this.storage.setItem('quake2ts_cvars', JSON.stringify(data));
      } catch (e) {
          console.warn('Failed to save settings', e);
      }
  }
}
