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
  team?: string; // Team name or identifier (e.g. "red", "blue")
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
            entry.team = existing.team;
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
      model: info.model,
      team: undefined
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

  /**
   * Parses the layout string from svc_layout and updates player scores.
   * Expected format example:
   * xv 32 yv 32 string "%4i %4i %-12.12s %4i"
   * followed by values? No, the string command draws text.
   * In Q2, the layout message sends a series of drawing commands.
   * The server formats the string:
   * "xv 32 yv %i string \"%4i %4i %-12.12s %4i\" "
   * The client receives the formatting commands AND the string data.
   * Wait, svc_layout in Q2 sends a single string that the client parses and draws.
   * The string contains tokens.
   * Example:
   * "xv 32 yv 32 string \"  10   50 PlayerName   10\""
   * We need to regex this.
   */
  public processScoreboardMessage(layout: string) {
      // Regex to find string commands
      // string "text"
      // text might contain quotes escaped? Q2 doesn't usually escape quotes inside the string command value like JSON.
      // It's usually `string "content"`
      // Content is: Frags Ping Name Time
      // %4i %4i %-12.12s %4i
      // Example: "  12   50 Julian         10"

      const stringCmdRegex = /string\s+"([^"]+)"/g;
      let match;

      // We need to match names to IDs. This is fuzzy if names are duplicates.
      // But it's the best we can do with standard Q2 layout.

      while ((match = stringCmdRegex.exec(layout)) !== null) {
          const content = match[1];

          // Check if this looks like a player row
          // It should have 3 numbers and a name?
          // Frags (int), Ping (int), Name (string), Time (int)
          // The name might contain spaces?
          // The format is fixed width usually.
          // "%4i %4i %-12.12s %4i"
          //  Frags: 0-4 chars
          //  Ping: 5-9 chars
          //  Name: 10-22 chars (12 chars max)
          //  Time: 23+ chars

          // Or we can try to split by whitespace, but name can have spaces?
          // Actually Q2 names can have spaces? I think they can.
          // But strict Q2 format uses fixed width for the name field in the scoreboard string.

          // Let's try to parse based on the known format.
          if (content.length > 20) {
              const fragsStr = content.substring(0, 4).trim();
              const pingStr = content.substring(5, 9).trim();
              const nameStr = content.substring(10, 22).trim();
              // const timeStr = content.substring(23, 27).trim();

              const frags = parseInt(fragsStr, 10);
              const ping = parseInt(pingStr, 10);

              if (!isNaN(frags) && !isNaN(ping) && nameStr.length > 0) {
                  // Find player by name
                  // We iterate all players to find a match
                  for (const player of this.players.values()) {
                      if (player.name === nameStr) {
                          player.frags = frags;
                          player.ping = ping;
                          // Deaths are not in standard layout
                      }
                  }
              }
          }
      }
      this.notifyUpdate();
  }
}
