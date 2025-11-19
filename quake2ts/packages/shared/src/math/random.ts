const STATE_SIZE = 624;
const MIDDLE_WORD = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
const TWO_POW_32 = 0x100000000;

/**
 * Minimal MT19937 implementation mirroring the rerelease's std::mt19937 usage in g_local.h.
 * The generator outputs deterministic unsigned 32-bit integers which drive the
 * higher-level helpers such as frandom/crandom/irandom.
 */
export class MersenneTwister19937 {
  private state = new Uint32Array(STATE_SIZE);
  private index = STATE_SIZE;

  constructor(seed = 5489) {
    this.seed(seed);
  }

  seed(seed: number): void {
    this.state[0] = seed >>> 0;
    for (let i = 1; i < STATE_SIZE; i++) {
      const prev = this.state[i - 1] ^ (this.state[i - 1] >>> 30);
      const next = Math.imul(prev >>> 0, 1812433253) + i;
      this.state[i] = next >>> 0;
    }
    this.index = STATE_SIZE;
  }

  nextUint32(): number {
    if (this.index >= STATE_SIZE) {
      this.twist();
    }

    let y = this.state[this.index++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  private twist(): void {
    for (let i = 0; i < STATE_SIZE; i++) {
      const y = (this.state[i] & UPPER_MASK) | (this.state[(i + 1) % STATE_SIZE] & LOWER_MASK);
      let next = this.state[(i + MIDDLE_WORD) % STATE_SIZE] ^ (y >>> 1);
      if ((y & 1) !== 0) {
        next ^= MATRIX_A;
      }
      this.state[i] = next >>> 0;
    }
    this.index = 0;
  }
}

export interface RandomGeneratorOptions {
  readonly seed?: number;
}

/**
 * Deterministic helper mirroring the random helpers defined in rerelease g_local.h.
 */
export class RandomGenerator {
  private readonly mt: MersenneTwister19937;

  constructor(options: RandomGeneratorOptions = {}) {
    this.mt = new MersenneTwister19937(options.seed);
  }

  /** Uniform float in [0, 1). */
  frandom(): number {
    return this.mt.nextUint32() / TWO_POW_32;
  }

  /** Uniform float in [min, max). */
  frandomRange(minInclusive: number, maxExclusive: number): number {
    return minInclusive + (maxExclusive - minInclusive) * this.frandom();
  }

  /** Uniform float in [0, max). */
  frandomMax(maxExclusive: number): number {
    return this.frandomRange(0, maxExclusive);
  }

  /** Uniform float in [-1, 1). */
  crandom(): number {
    return this.frandomRange(-1, 1);
  }

  /** Uniform float in (-1, 1). */
  crandomOpen(): number {
    const epsilon = Number.EPSILON;
    return this.frandomRange(-1 + epsilon, 1);
  }

  /** Raw uint32 sample. */
  irandomUint32(): number {
    return this.mt.nextUint32();
  }

  /** Uniform integer in [min, max). */
  irandomRange(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive - minInclusive <= 1) {
      return minInclusive;
    }

    const span = maxExclusive - minInclusive;
    const limit = TWO_POW_32 - (TWO_POW_32 % span);
    let sample: number;
    do {
      sample = this.mt.nextUint32();
    } while (sample >= limit);
    return minInclusive + (sample % span);
  }

  /** Uniform integer in [0, max). */
  irandom(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      return 0;
    }
    return this.irandomRange(0, maxExclusive);
  }

  /** Uniform time in milliseconds [min, max). */
  randomTimeRange(minMs: number, maxMs: number): number {
    if (maxMs <= minMs) {
      return minMs;
    }
    return this.irandomRange(minMs, maxMs);
  }

  /** Uniform time in milliseconds [0, max). */
  randomTime(maxMs: number): number {
    return this.irandom(maxMs);
  }

  randomIndex<T extends { length: number }>(container: T): number {
    return this.irandom(container.length);
  }
}

export function createRandomGenerator(options?: RandomGeneratorOptions): RandomGenerator {
  return new RandomGenerator(options);
}
