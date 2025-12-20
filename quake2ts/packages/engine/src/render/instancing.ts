import { Vec3 } from '@quake2ts/shared';
import { Md2Model } from '../assets/md2.js';
import { Md3Model } from '../assets/md3.js';

export interface InstanceData {
  position: Vec3;
  rotation: Vec3;
  scale?: Vec3;

  // Animation
  frame?: number;      // Single frame (implies frame0=frame, frame1=frame, lerp=0)
  frame0?: number;     // Blend frame 0
  frame1?: number;     // Blend frame 1
  lerp?: number;       // Interpolation factor (0..1)

  skin?: number;
}
