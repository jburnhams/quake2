import { ANORMS } from '../math/anorms.js';
import { Vec3 } from '../math/vec3.js';
import { BinaryWriter as BaseBinaryWriter } from 'strata-binary';

/** The generic BinaryWriter from strata-binary plus Quake 2's coordinate, angle and direction encodings. */
export class BinaryWriter extends BaseBinaryWriter {
  public writeCoord(value: number): void {
    this.writeShort(Math.trunc(value * 8));
  }

  // MSG_WriteAngle and ANGLE2SHORT work in 32-bit floats ((f * 256) / 360, each step rounded);
  // in doubles an angle far outside 0..360 can truncate to the next value (oracle/tests/msg).
  public writeAngle(value: number): void {
    this.writeByte(Math.trunc(Math.fround(Math.fround(Math.fround(value) * 256) / 360)) & 255);
  }

  public writeAngle16(value: number): void {
    this.writeShort(Math.trunc(Math.fround(Math.fround(Math.fround(value) * 65536) / 360)) & 65535);
  }

  public writePos(pos: Vec3): void {
    this.writeCoord(pos.x);
    this.writeCoord(pos.y);
    this.writeCoord(pos.z);
  }

  public writeDir(dir: Vec3): void {
      // Find closest normal
      let maxDot = -1.0;
      let bestIndex = 0;

      // Check for zero vector
      if (dir.x === 0 && dir.y === 0 && dir.z === 0) {
        this.writeByte(0);
        return;
      }

      for (let i = 0; i < ANORMS.length; i++) {
        const norm = ANORMS[i];
        const dot = dir.x * norm[0] + dir.y * norm[1] + dir.z * norm[2];
        if (dot > maxDot) {
          maxDot = dot;
          bestIndex = i;
        }
      }

      this.writeByte(bestIndex);
  }
}
