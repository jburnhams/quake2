import { describe, it, expect, vi } from 'vitest';
import {
    createMockAI,
    createMockMonsterAI,
    createMockMonsterMove
} from '../../../src/game/mocks/ai';

describe('AI Mocks', () => {
    describe('createMockAI', () => {
        it('should create default AI mocks', () => {
            const ai = createMockAI();
            expect(ai.checkAttack).toBeDefined();
            expect(ai.findTarget).toBeDefined();
        });

        it('should support overrides', () => {
            const customFind = vi.fn();
            const ai = createMockAI({ findTarget: customFind });
            expect(ai.findTarget).toBe(customFind);
        });
    });

    describe('createMockMonsterAI', () => {
        it('should create monster AI definition', () => {
            const mai = createMockMonsterAI();
            expect(mai.stand).toBeDefined();
            expect(mai.run).toBeDefined();
            expect(mai.attack).toBeDefined();
        });
    });

    describe('createMockMonsterMove', () => {
        it('should create move definition', () => {
            const move = createMockMonsterMove(1, 2, vi.fn(), vi.fn());
            expect(move.firstframe).toBe(1);
            expect(move.lastframe).toBe(2);
            expect(move.frames.length).toBe(2);
            expect(move.frames[0].think).toBeDefined();
        });
    });
});
