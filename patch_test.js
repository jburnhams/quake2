const fs = require('fs');
const file = 'quake2ts/packages/bsp-tools/tests/unit-node/lighting/full.test.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace("import { createMockCompileFace } from '@quake2ts/test-utils';", '');
code = code.replace("...createMockCompileFace(0),", "bounds: { mins: createVector3(-64, -64, 0), maxs: createVector3(64, 64, 0) }, next: null, original: {} as any, sides: [],");

fs.writeFileSync(file, code);
