import { Camera } from '../../../src/render/camera.js';
import { vec3, mat4 } from 'gl-matrix';
import { describe, it, expect } from 'vitest';

describe('Camera Viewmodel Effects', () => {
    it('should apply bob angles', () => {
        const camera = new Camera();
        camera.angles = vec3.fromValues(10, 20, 0);

        const matrixWithoutBob = mat4.clone(camera.viewMatrix);

        camera.bobAngles = vec3.fromValues(5, 0, 0);
        const matrixWithBob = mat4.clone(camera.viewMatrix);

        expect(matrixWithBob).not.toEqual(matrixWithoutBob);
    });

    it('should apply kick angles', () => {
        const camera = new Camera();
        camera.angles = vec3.fromValues(10, 20, 0);

        const matrixWithoutKick = mat4.clone(camera.viewMatrix);

        camera.kickAngles = vec3.fromValues(-5, 0, 0);
        const matrixWithKick = mat4.clone(camera.viewMatrix);

        expect(matrixWithKick).not.toEqual(matrixWithoutKick);
    });

    it('should apply roll angle', () => {
        const camera = new Camera();
        camera.angles = vec3.fromValues(10, 20, 0);

        const matrixWithoutRoll = mat4.clone(camera.viewMatrix);

        camera.rollAngle = 15;
        const matrixWithRoll = mat4.clone(camera.viewMatrix);

        expect(matrixWithRoll).not.toEqual(matrixWithoutRoll);
    });

    it('should apply combined effects', () => {
        const camera = new Camera();
        camera.angles = vec3.fromValues(10, 20, 0);

        const matrixWithoutEffects = mat4.clone(camera.viewMatrix);

        camera.bobAngles = vec3.fromValues(5, 2, 0);
        camera.kickAngles = vec3.fromValues(-5, 0, 0);
        camera.rollAngle = 15;
        const matrixWithEffects = mat4.clone(camera.viewMatrix);

        expect(matrixWithEffects).not.toEqual(matrixWithoutEffects);
    });
});
