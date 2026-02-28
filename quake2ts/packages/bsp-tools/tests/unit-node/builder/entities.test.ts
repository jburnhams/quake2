import { describe, it, expect } from 'vitest';
import { playerStart, light, trigger, funcDoor, funcButton } from '../../../src/builder/entities.js';
import { box } from '../../../src/builder/primitives.js';

describe('builder/entities', () => {
  describe('playerStart', () => {
    it('should create info_player_start', () => {
      const e = playerStart({ x: 100, y: 200, z: 300 }, 90);
      expect(e.classname).toBe('info_player_start');
      expect(e.properties.origin).toBe('100 200 300');
      expect(e.properties.angle).toBe('90');
    });

    it('should handle missing angle', () => {
      const e = playerStart({ x: 0, y: 0, z: 0 });
      expect(e.properties.angle).toBeUndefined();
    });
  });

  describe('light', () => {
    it('should create light with default intensity', () => {
      const e = light({ x: 0, y: 0, z: 0 });
      expect(e.classname).toBe('light');
      expect(e.properties.light).toBe('300');
    });

    it('should handle custom intensity and color', () => {
      const e = light({ x: 0, y: 0, z: 0 }, 500, { x: 1, y: 0, z: 0 });
      expect(e.properties.light).toBe('500');
      expect(e.properties._color).toBe('1 0 0');
    });
  });

  describe('trigger', () => {
    it('should create trigger_multiple with brush', () => {
      const e = trigger({ x: 0, y: 0, z: 0 }, { x: 64, y: 64, z: 64 }, 'target1');
      expect(e.classname).toBe('trigger_multiple');
      expect(e.properties.target).toBe('target1');
      expect(e.brushes).toHaveLength(1);
    });
  });

  describe('funcDoor', () => {
    it('should create func_door with brush', () => {
      const b = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 10, z: 10 } });
      const e = funcDoor(b, { speed: '100', wait: '2' });
      expect(e.classname).toBe('func_door');
      expect(e.properties.speed).toBe('100');
      expect(e.brushes).toHaveLength(1);
    });
  });

  describe('funcButton', () => {
    it('should create func_button with brush', () => {
      const b = box({ origin: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 10, z: 10 } });
      const e = funcButton(b, 'target2');
      expect(e.classname).toBe('func_button');
      expect(e.properties.target).toBe('target2');
      expect(e.brushes).toHaveLength(1);
    });
  });
});
