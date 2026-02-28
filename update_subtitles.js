const fs = require('fs');
const file = 'quake2ts/packages/cgame/tests/unit-node/hud/subtitles.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /const mockCgi = \{[\s\S]*?\} as unknown as CGameImport;/,
    "import { createMockCGameImport } from '@quake2ts/test-utils';\n\nconst mockCgi = createMockCGameImport();"
);

fs.writeFileSync(file, code);
