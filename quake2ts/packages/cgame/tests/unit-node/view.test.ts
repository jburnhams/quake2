import { describe, it, expect, vi } from 'vitest';
import { createMockCamera } from '@quake2ts/test-utils';
import { ViewSample } from '../../src/view/effects.js';
import { updateCamera } from '../../src/view/camera.js';
import { vec3 } from 'gl-matrix';
import { Vec3 } from '@quake2ts/shared';

describe('View', () => {
    it('should update camera with view effects', () => {
        const mockCamera = createMockCamera();

        const mockViewSample: ViewSample = {
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
