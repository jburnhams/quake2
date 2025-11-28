import { describe, it, expect } from 'vitest';
import { updateCamera } from '../src/view/camera.js';
import { vec3 } from 'gl-matrix';
describe('View', () => {
    it('should update camera with view effects', () => {
        const mockCamera = {
            bobAngles: vec3.create(),
            bobOffset: vec3.create(),
        };
        const mockViewSample = {
            angles: { x: 1, y: 2, z: 3 },
            offset: { x: 4, y: 5, z: 6 },
            bobCycle: 0,
            bobCycleRun: 0,
            bobFracSin: 0,
            xyspeed: 0,
        };
        updateCamera(mockCamera, mockViewSample);
        expect(mockCamera.bobAngles).toEqual(vec3.fromValues(1, 2, 3));
        expect(mockCamera.bobOffset).toEqual(vec3.fromValues(4, 5, 6));
    });
});
