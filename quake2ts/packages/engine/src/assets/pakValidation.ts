import { PakArchive, normalizePath, type PakValidationResult } from './pak.js';

export interface KnownPakChecksum {
  readonly name: string;
  readonly checksum: number;
  readonly size?: number;
  readonly description?: string;
}

export interface PakValidationOutcome {
  readonly name: string;
  readonly checksum: number;
  readonly expectedChecksum?: number;
  readonly size?: number;
  readonly status: 'valid' | 'mismatch' | 'unknown';
  readonly description?: string;
}

export const RERELEASE_KNOWN_PAKS: readonly KnownPakChecksum[] = Object.freeze([
  // Base campaign
  { name: 'pak0.pak', checksum: 0x8dbe2e6d, description: 'Base game assets' },
  // Mission packs bundled with the rerelease
  { name: 'pak0.pak@rogue', checksum: 0xc90f1e6d, description: 'Ground Zero (rogue) mission pack' },
  { name: 'pak0.pak@xatrix', checksum: 0x50f58d80, description: 'The Reckoning (xatrix) mission pack' },
]);

export class PakValidationError extends Error {
  constructor(readonly result: PakValidationOutcome) {
    super(
      result.status === 'unknown'
        ? `Unknown PAK not allowed: ${result.name}`
        : `PAK checksum mismatch for ${result.name}`,
    );
    this.name = 'PakValidationError';
  }
}

export class PakValidator {
  private readonly known = new Map<string, KnownPakChecksum>();

  constructor(knownPaks: readonly KnownPakChecksum[] = RERELEASE_KNOWN_PAKS) {
    knownPaks.forEach((pak) => this.known.set(this.normalizePakName(pak.name), pak));
  }

  validateArchive(archive: PakArchive | PakValidationResult, nameOverride?: string): PakValidationOutcome {
    const pakName = this.normalizePakName(nameOverride ?? ('name' in archive ? archive.name : 'unknown'));
    const checksum = archive.checksum;
    const size = 'size' in archive ? archive.size : undefined;

    const known = this.known.get(pakName);
    if (!known) {
      return { name: pakName, checksum, status: 'unknown', size };
    }

    if (known.checksum !== checksum) {
      return {
        name: pakName,
        checksum,
        expectedChecksum: known.checksum,
        status: 'mismatch',
        size,
        description: known.description,
      };
    }

    return {
      name: pakName,
      checksum,
      expectedChecksum: known.checksum,
      status: 'valid',
      size,
      description: known.description,
    };
  }

  assertValid(archive: PakArchive | PakValidationResult, nameOverride?: string): PakValidationOutcome {
    const outcome = this.validateArchive(archive, nameOverride);
    if (outcome.status === 'mismatch') {
      throw new PakValidationError(outcome);
    }
    return outcome;
  }

  private normalizePakName(name: string): string {
    const normalized = normalizePath(name);
    const parts = normalized.split('/');
    const filename = parts.pop() ?? normalized;
    const directory = parts.pop();
    return directory ? `${filename}@${directory}` : filename;
  }
}
