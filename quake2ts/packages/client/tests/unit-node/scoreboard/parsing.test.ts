import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoreboardManager } from '@quake2ts/client/scoreboard.js';
import { ClientConfigStrings } from '@quake2ts/client/configStrings.js';
import { ConfigStringIndex } from '@quake2ts/shared';

describe('ScoreboardManager', () => {
    let configStrings: ClientConfigStrings;
    let scoreboardManager: ScoreboardManager;

    beforeEach(() => {
        configStrings = new ClientConfigStrings();
        scoreboardManager = new ScoreboardManager(configStrings);
    });

    it('should parse player config strings correctly', () => {
        const player0String = '\\name\\Player1\\skin\\male/grunt';
        // Simulate config string update
        configStrings.set(ConfigStringIndex.PlayerSkins + 0, player0String);
        scoreboardManager.parseConfigString(ConfigStringIndex.PlayerSkins + 0, player0String);

        const scoreboard = scoreboardManager.getScoreboard();

        expect(scoreboard.players).toHaveLength(1);
        expect(scoreboard.players[0]).toEqual({
            id: 0,
            name: 'Player1',
            frags: 0,
            deaths: 0,
            ping: 0,
            skin: 'male/grunt',
            model: undefined
        });
    });

    it('should maintain state and update scores', () => {
        const player0String = '\\name\\Player1\\skin\\male/grunt';
        scoreboardManager.parseConfigString(ConfigStringIndex.PlayerSkins + 0, player0String);

        scoreboardManager.updateScore(0, 5, 1, 50);

        const scoreboard = scoreboardManager.getScoreboard();
        expect(scoreboard.players[0]).toEqual({
            id: 0,
            name: 'Player1',
            frags: 5,
            deaths: 1,
            ping: 50,
            skin: 'male/grunt',
            model: undefined
        });
    });

    it('should preserve scores when updating player info', () => {
        const player0String = '\\name\\Player1\\skin\\male/grunt';
        scoreboardManager.parseConfigString(ConfigStringIndex.PlayerSkins + 0, player0String);
        scoreboardManager.updateScore(0, 10, 2, 40);

        // Update name
        const player0NewString = '\\name\\NewName\\skin\\male/grunt';
        scoreboardManager.parseConfigString(ConfigStringIndex.PlayerSkins + 0, player0NewString);

        const scoreboard = scoreboardManager.getScoreboard();
        expect(scoreboard.players[0].name).toBe('NewName');
        expect(scoreboard.players[0].frags).toBe(10);
    });

    it('should remove player when config string is empty', () => {
        const player0String = '\\name\\Player1';
        scoreboardManager.parseConfigString(ConfigStringIndex.PlayerSkins + 0, player0String);
        expect(scoreboardManager.getScoreboard().players).toHaveLength(1);

        // Set empty
        scoreboardManager.parseConfigString(ConfigStringIndex.PlayerSkins + 0, '');
        expect(scoreboardManager.getScoreboard().players).toHaveLength(0);
    });

    it('should notify listeners on update', () => {
        const listener = vi.fn();
        scoreboardManager.addListener(listener);

        scoreboardManager.notifyUpdate();
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
