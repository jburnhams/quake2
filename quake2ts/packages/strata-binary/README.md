# strata-binary

Little-endian binary reading and writing over `DataView`, with no dependencies and nothing
game-specific. General tier of the library split (see [`../../LIBRARIES.md`](../../LIBRARIES.md)).

```ts
import { BinaryReader, BinaryWriter } from 'strata-binary';

const w = new BinaryWriter();          // grows by doubling; new BinaryWriter(bytes) is fixed-size
w.writeLong(4);
w.writeString('maps/demo1.bsp');       // NUL-terminated, one byte per char
const r = new BinaryReader(w.getData());
r.readLong();                          // 4
r.readString();                        // 'maps/demo1.bsp'
```

| Reader | Writer |
|---|---|
| `readByte` `readChar` `readShort` `readUShort` `readLong` `readULong` `readFloat` | `writeByte` `writeChar` `writeShort` `writeUShort` `writeLong` `writeFloat` |
| `readString` (stops at 0, 0xFF or the end), `readStringLine` (also at `\n`), `readData(n)` (a copy) | `writeString`, `writeBytes` |
| `seek`, `getPosition`, `getRemaining`, `hasMore`, `hasBytes(n)` | `getData` (a copy), `getBuffer`, `getOffset`, `reset` |

A read past the end throws (`RangeError` from `DataView`, or `Read out of bounds` from `readData`);
a fixed-size writer throws `Buffer overflow`.

`@quake2ts/shared`'s `BinaryStream` and `BinaryWriter` extend these with Quake 2's coordinate, angle
and direction encodings.
