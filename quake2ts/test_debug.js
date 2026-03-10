const { vi } = require('vitest');
const vfs = { readFile: vi.fn().mockRejectedValue(new Error('File not found (mock)')) };
vi.spyOn(vfs, 'readFile').mockImplementation(async (path) => {
    return "mocked";
});
vfs.readFile('test').then(console.log).catch(console.error);
