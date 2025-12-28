try {
  const testUtils = require('@quake2ts/test-utils');
  console.log('Successfully required @quake2ts/test-utils');
} catch (e) {
  console.error('Failed to require @quake2ts/test-utils:', e);
  process.exit(1);
}
