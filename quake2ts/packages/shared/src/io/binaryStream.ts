import { Vec3 } from '../math/vec3.js';
import { ANORMS } from '../math/anorms.js';
import { BinaryReader as BaseBinaryReader } from 'strata-binary';

/** The generic BinaryReader from strata-binary plus Quake 2's coordinate, angle and direction encodings. */
export class BinaryStream extends BaseBinaryReader {
  public readCoord(): number {
    return this.readShort() * (1.0 / 8.0);
  }

  public readAngle(): number {
    return this.readChar() * (360.0 / 256.0);
  }

  public readAngle16(): number {
    return (this.readShort() * 360.0) / 65536.0;
  }

  public readPos(out: { x: number, y: number, z: number }): void {
    out.x = this.readCoord();
    out.y = this.readCoord();
    out.z = this.readCoord();
  }

  public readDir(out: { x: number, y: number, z: number }): void {
    const b = this.readByte();
    if (b >= 162) { // NUMVERTEXNORMALS
      out.x = 0; out.y = 0; out.z = 0;
      return;
    }
    const norm = ANORMS[b];
    out.x = norm[0];
    out.y = norm[1];
    out.z = norm[2];
  }
}
