const fs = require('fs');
const file = 'quake2ts/packages/cgame/tests/unit-node/hud/statusbar.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
    /import \{ PlayerState, PlayerStat \} from '@quake2ts\/shared';/,
    "import { PlayerStat } from '@quake2ts/shared';\nimport { createMockCGameImport, createMockPlayerState } from '@quake2ts/test-utils';"
);

code = code.replace(
    /const cgi = \{[\s\S]*?\} as unknown as CGameImport;/,
    "const cgi = createMockCGameImport({\n      SCR_DrawPic: vi.fn(),\n      Draw_GetPicSize: vi.fn(() => ({ width: 10, height: 10 })),\n      Draw_RegisterPic: vi.fn((name) => `mock_pic_${name}`),\n      SCR_DrawChar: vi.fn(),\n      SCR_MeasureFontString: vi.fn(() => 100),\n      SCR_DrawFontString: vi.fn(),\n    });"
);

code = code.replace(
    /const ps = \{[\s\S]*?\} as unknown as PlayerState;/,
    "const ps = createMockPlayerState({\n      pickupIcon: 'w_shotgun',\n    });"
);

code = code.replace(
    /const cgi = \{[\s\S]*?\} as unknown as CGameImport;/g,
    "const cgi = createMockCGameImport({\n      SCR_DrawPic: vi.fn(),\n      Draw_GetPicSize: vi.fn(() => ({ width: 10, height: 10 })),\n      Draw_RegisterPic: vi.fn(),\n    });"
);

code = code.replace(
    /const ps = \{\n      stats: \[\], \/\/ Empty stats\n    \} as unknown as PlayerState;/,
    "const ps = createMockPlayerState();"
);

fs.writeFileSync(file, code);
