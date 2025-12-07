import { BinaryStream } from '@quake2ts/shared';
import { ServerCommand } from '@quake2ts/shared';

export interface DemoValidationResult {
  valid: boolean;
  error?: string;
  version?: number;
}

export class DemoValidator {
  /**
   * Validates a Quake 2 demo file buffer.
   * Checks for minimum size, first block length, and initial serverdata command.
   */
  public static validate(buffer: ArrayBuffer, filename?: string): DemoValidationResult {
    // 1. Check file extension if filename provided
    if (filename && !filename.toLowerCase().endsWith('.dm2')) {
      return { valid: false, error: 'Invalid file extension (expected .dm2)' };
    }

    // 2. Verify minimum file size
    // Need at least 4 bytes for length, plus at least 1 byte for command
    if (buffer.byteLength < 5) {
      return { valid: false, error: 'File too small to be a valid demo' };
    }

    const view = new DataView(buffer);
    const length = view.getInt32(0, true);

    // 3. Verify first block length
    // Length must be positive and fit within the file
    if (length <= 0 || length > buffer.byteLength - 4) {
      return { valid: false, error: `Invalid first block length: ${length}` };
    }

    // 4. Verify first command is svc_serverdata
    // The first message block usually starts with svc_serverdata (12)
    // Read the first byte of the data block
    const firstCmd = view.getUint8(4);

    // svc_serverdata is 12 (decimal)
    if (firstCmd !== ServerCommand.serverdata) {
      return {
        valid: false,
        error: `First command is not svc_serverdata (expected ${ServerCommand.serverdata}, got ${firstCmd})`
      };
    }

    // Try to parse protocol version from serverdata
    // svc_serverdata(1) + protocol(4) + ...
    let version = -1;
    if (length >= 5) {
        version = view.getInt32(5, true);
    }

    return { valid: true, version };
  }
}
