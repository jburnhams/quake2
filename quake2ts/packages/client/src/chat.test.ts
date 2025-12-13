import { describe, it, expect, vi } from 'vitest';
import { ChatManager } from './chat.js';

describe('ChatManager', () => {
    it('should parse standard chat messages', () => {
        const manager = new ChatManager(vi.fn());
        manager.addMessage(0, 'Player1: Hello World');

        const history = manager.getHistory();
        expect(history.length).toBe(1);
        expect(history[0].sender).toBe('Player1');
        expect(history[0].text).toBe('Hello World');
        expect(history[0].team).toBe(false);
    });

    it('should parse team chat messages', () => {
        const manager = new ChatManager(vi.fn());
        manager.addMessage(0, '(Player2): Team plan');

        const history = manager.getHistory();
        expect(history.length).toBe(1);
        expect(history[0].sender).toBe('Player2');
        expect(history[0].text).toBe('Team plan');
        expect(history[0].team).toBe(true);
    });

    it('should identify system messages', () => {
        const manager = new ChatManager(vi.fn());
        manager.addMessage(0, 'Connection accepted.');

        const history = manager.getHistory();
        expect(history[0].sender).toBeUndefined();
        expect(history[0].text).toBe('Connection accepted.');
    });

    it('should notify listeners on chat', () => {
        const manager = new ChatManager(vi.fn());
        const listener = vi.fn();
        manager.addListener(listener);

        manager.addMessage(0, 'Player1: Test');

        expect(listener).toHaveBeenCalledWith('Player1', 'Test', false);
    });

    it('should send messages via command', () => {
        const sendCmd = vi.fn();
        const manager = new ChatManager(sendCmd);

        manager.sendChatMessage('Hello', false);
        expect(sendCmd).toHaveBeenCalledWith('say "Hello"');

        manager.sendChatMessage('Team info', true);
        expect(sendCmd).toHaveBeenCalledWith('say_team "Team info"');
    });

    it('should escape quotes in chat messages', () => {
        const sendCmd = vi.fn();
        const manager = new ChatManager(sendCmd);

        manager.sendChatMessage('Hello "world"', false);
        expect(sendCmd).toHaveBeenCalledWith('say "Hello \\"world\\""');
    });

    it('should limit history', () => {
        const manager = new ChatManager(vi.fn());
        for (let i = 0; i < 110; i++) {
            manager.addMessage(0, `Msg ${i}`);
        }
        expect(manager.getHistory().length).toBe(100);
    });
});
