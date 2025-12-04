import fs from 'fs';
import path from 'path';
import { PakArchive } from '@quake2ts/engine';

export function extractMapFromPak(mapName: string, destDir: string, pakPath: string = 'pak.pak') {
  if (!fs.existsSync(pakPath)) {
    console.error(`PAK file not found at ${pakPath}`);
    return false;
  }

  const buffer = fs.readFileSync(pakPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

  try {
    const archive = PakArchive.fromArrayBuffer('pak.pak', arrayBuffer);
    const entry = archive.getEntry(mapName);

    if (entry) {
      const data = archive.readFile(mapName);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.writeFileSync(path.join(destDir, path.basename(mapName)), Buffer.from(data));
      return true;
    } else {
      console.warn(`Map ${mapName} not found in PAK.`);
      return false;
    }
  } catch (e) {
    console.error('Error extracting map:', e);
    return false;
  }
}
