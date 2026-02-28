const fs = require('fs');
const file = 'quake2ts/packages/cgame/tests/unit-node/hud/messages.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /import type \{ CGameImport \} from '\.\.\/\.\.\/\.\.\/src\/types\.js';/,
    "import type { CGameImport } from '../../../src/types.js';\nimport { createMockCGameImport } from '@quake2ts/test-utils';"
);

code = code.replace(
    /mockCgi = \{[\s\S]*?\} as unknown as CGameImport;/,
    "mockCgi = createMockCGameImport({ SCR_DrawFontString: vi.fn(), SCR_FontLineHeight: vi.fn().mockReturnValue(12) });"
);

fs.writeFileSync(file, code);
