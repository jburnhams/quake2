import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoreboardManager, ScoreboardEntry } from './scoreboard.js';
import { ClientConfigStrings } from './configStrings.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('ScoreboardManager', () => {
    let configStrings: ClientConfigStrings;
    let manager: ScoreboardManager;

    beforeEach(() => {
        configStrings = new ClientConfigStrings();
        manager = new ScoreboardManager(configStrings);
    });

    it('should parse player config strings', () => {
        const playerIndex = ConfigStringIndex.PlayerSkins + 0;
        const playerStr = '\\name\\Player1\\skin\\male/grunt';

        configStrings.set(playerIndex, playerStr);
        manager.parseConfigString(playerIndex, playerStr);

        const data = manager.getScoreboard();
        expect(data.players.length).toBe(1);
        expect(data.players[0].name).toBe('Player1');
        expect(data.players[0].skin).toBe('male/grunt');
    });

    it('should process layout string and update scores', () => {
        // Setup player
        const playerIndex = ConfigStringIndex.PlayerSkins + 0;
        const playerStr = '\\name\\Player1\\skin\\male/grunt';
        manager.parseConfigString(playerIndex, playerStr);

        // Q2 Layout string example:
        // "xv 32 yv 32 string \"   5  100 Player1        0\""
        // Frags: 5, Ping: 100, Name: Player1
        const layout = 'xv 32 yv 32 string "   5  100 Player1        0"';

        manager.processScoreboardMessage(layout);

        const data = manager.getScoreboard();
        expect(data.players[0].frags).toBe(5);
        expect(data.players[0].ping).toBe(100);
    });

    it('should handle updates via notify listener', () => {
        const listener = vi.fn();
        manager.addListener(listener);

        const playerIndex = ConfigStringIndex.PlayerSkins + 0;
        manager.parseConfigString(playerIndex, '\\name\\Player1');

        // Should trigger update
        manager.updateScore(0, 10, 2, 50);

        expect(listener).toHaveBeenCalled();
        const data = manager.getScoreboard();
        expect(data.players[0].frags).toBe(10);
        expect(data.players[0].deaths).toBe(2);
        expect(data.players[0].ping).toBe(50);
    });

    it('should maintain state when re-parsing config string', () => {
        const playerIndex = ConfigStringIndex.PlayerSkins + 0;
        manager.parseConfigString(playerIndex, '\\name\\Player1');
        manager.updateScore(0, 10, 0, 0);

        // Update skin (re-parse)
        manager.parseConfigString(playerIndex, '\\name\\Player1\\skin\\female/aten');

        const data = manager.getScoreboard();
        expect(data.players[0].frags).toBe(10); // Should persist
        expect(data.players[0].skin).toBe('female/aten');
    });
});
