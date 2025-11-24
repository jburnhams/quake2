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
                  // Only update if cvar exists (is registered)
                  // Note: In real engine, we might set pending cvars.
                  // Here we assume we are calling this after registration or allowing setting pending.
                  // If we have a 'set' method that handles unregistered, great.
                  // But 'cvars' map passed here implies existing objects.
                  // Let's assume we just update the value.
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

  saveCvars(cvars: Map<string, { value: string, archive: boolean }>) {
      const data: Record<string, string> = {};
      for (const [key, cvar] of cvars.entries()) {
          if (cvar.archive) {
              data[key] = cvar.value;
          }
      }
      try {
          this.storage.setItem('quake2ts_cvars', JSON.stringify(data));
      } catch (e) {
          console.warn('Failed to save settings', e);
      }
  }
}
