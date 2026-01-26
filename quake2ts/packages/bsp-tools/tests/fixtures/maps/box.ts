import { createHollowBox, type MapEntity } from '../mapWriter.js';

export function createBoxRoom(size = 512, wallThickness = 16): MapEntity[] {
  return [{
    classname: 'worldspawn',
    properties: { message: 'Test Box Room' },
    brushes: createHollowBox({ x: 0, y: 0, z: 0 }, { x: size, y: size, z: size }, wallThickness)
  }, {
    classname: 'info_player_start',
    properties: { origin: `${size/2} ${size/2} 32` }
  }];
}
