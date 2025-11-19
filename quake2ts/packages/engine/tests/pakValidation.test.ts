import { describe, expect, it } from 'vitest';
import { PakArchive } from '../src/assets/pak.js';
import { PakValidator, PakValidationError } from '../src/assets/pakValidation.js';
import { buildPak, textData } from './helpers/pakBuilder.js';

describe('PakValidator', () => {
  const pakBuffer = buildPak([{ path: 'maps/base1.bsp', data: textData('world') }]);
  const archive = PakArchive.fromArrayBuffer('pak0.pak', pakBuffer);

  it('marks known paks as valid and mismatched ones as errors', () => {
    const validator = new PakValidator([{ name: 'pak0.pak', checksum: archive.checksum }]);
    const result = validator.validateArchive(archive);
    expect(result.status).toBe('valid');

    const mismatchValidator = new PakValidator([{ name: 'pak0.pak', checksum: archive.checksum + 1 }]);
    const mismatch = mismatchValidator.validateArchive(archive);
    expect(mismatch.status).toBe('mismatch');
    expect(() => mismatchValidator.assertValid(archive)).toThrow(PakValidationError);
  });

  it('reports unknown paks distinctly', () => {
    const validator = new PakValidator([]);
    const outcome = validator.validateArchive(archive);
    expect(outcome.status).toBe('unknown');
  });
});
