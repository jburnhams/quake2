import { SettingsStorage } from './settings.js';

export class LocalStorageSettings implements SettingsStorage {
    getItem(key: string): string | null {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage not available', e);
            return null;
        }
    }

    setItem(key: string, value: string): void {
        try {
            localStorage.setItem(key, value);
        } catch (e) {
            console.warn('Failed to write to localStorage', e);
        }
    }
}

export { BrowserSettings, SettingsStorage } from './settings.js';
