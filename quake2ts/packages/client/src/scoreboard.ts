import { ConfigStringIndex, MAX_CLIENTS } from '@quake2ts/shared';
import { ClientConfigStrings } from './configStrings.js';

export interface ScoreboardEntry {
  name: string;
  frags: number;
  deaths: number;
  ping: number;
  id: number;
  skin?: string;
  model?: string;
}

export interface ScoreboardData {
  players: ScoreboardEntry[];
  mapName: string;
}

export class ScoreboardManager {
  private configStrings: ClientConfigStrings;
  private localPlayerId: number = -1;
  private listeners: ((data: ScoreboardData) => void)[] = [];

  // Cache players to support stateful updates (e.g. scores)
  private players: Map<number, ScoreboardEntry> = new Map();

  constructor(configStrings: ClientConfigStrings) {
    this.configStrings = configStrings;
    this.refreshAll();
  }

  public setLocalPlayerId(id: number) {
    this.localPlayerId = id;
  }

  public addListener(listener: (data: ScoreboardData) => void) {
    this.listeners.push(listener);
  }

  public removeListener(listener: (data: ScoreboardData) => void) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  public notifyUpdate() {
    const data = this.getScoreboard();
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  private refreshAll() {
    this.players.clear();
    for (let i = 0; i < MAX_CLIENTS; i++) {
        const csIndex = ConfigStringIndex.PlayerSkins + i;
        const str = this.configStrings.get(csIndex);
        if (str && str.length > 0) {
            this.parseConfigString(csIndex, str);
        }
    }
  }

  public parseConfigString(index: number, str: string) {
    if (index < ConfigStringIndex.PlayerSkins || index >= ConfigStringIndex.PlayerSkins + MAX_CLIENTS) {
        return;
    }
    const id = index - ConfigStringIndex.PlayerSkins;

    // If string is empty, remove player
    if (!str || str.length === 0) {
        if (this.players.has(id)) {
            this.players.delete(id);
        }
        return;
    }

    const entry = this.parsePlayerConfigString(id, str);
    if (entry) {
        // Preserve existing scores if updating same player
        const existing = this.players.get(id);
        if (existing) {
            entry.frags = existing.frags;
            entry.deaths = existing.deaths;
            entry.ping = existing.ping;
        }
        this.players.set(id, entry);
    }
  }

  public getScoreboard(): ScoreboardData {
    const players = Array.from(this.players.values());

    // Sort by frags (descending)
    players.sort((a, b) => b.frags - a.frags);

    // Get map name (ConfigStringIndex.Name is server name, usually map name is in another CS or serverinfo)
    const worldModel = this.configStrings.getModelName(1);
    let mapName = 'unknown';
    if (worldModel) {
      // Extract map name from maps/foo.bsp
      const match = worldModel.match(/maps\/(.*)\.bsp/i);
      if (match) {
        mapName = match[1];
      } else {
        mapName = worldModel;
      }
    }

    return {
      players,
      mapName
    };
  }

  private parsePlayerConfigString(id: number, str: string): ScoreboardEntry | null {
    // Format: \name\Player\skin\male/grunt...
    const parts = str.split('\\');
    const info: Record<string, string> = {};

    // Skip empty first part if string starts with \
    let startIndex = 0;
    if (parts.length > 0 && parts[0] === '') {
      startIndex = 1;
    }

    for (let i = startIndex; i < parts.length; i += 2) {
      if (i + 1 < parts.length) {
        const key = parts[i].toLowerCase();
        const value = parts[i + 1];
        info[key] = value;
      }
    }

    if (!info.name) {
      return null;
    }

    return {
      id,
      name: info.name,
      frags: 0,
      deaths: 0,
      ping: 0,
      skin: info.skin,
      model: info.model
    };
  }

  // Method to update scores explicitly
  public updateScore(id: number, frags: number, deaths: number, ping: number) {
    const player = this.players.get(id);
    if (player) {
        player.frags = frags;
        player.deaths = deaths;
        player.ping = ping;
        this.notifyUpdate();
    }
  }
}
