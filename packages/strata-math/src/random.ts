const STATE_SIZE = 624;
const MIDDLE_WORD = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;
const TWO_POW_32 = 0x100000000;

export interface MersenneTwisterState {
  readonly index: number;
  readonly state: readonly number[];
}

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

  getState(): MersenneTwisterState {
    return {
      index: this.index,
      state: Array.from(this.state),
    };
  }

  setState(snapshot: MersenneTwisterState): void {
    if (snapshot.state.length !== STATE_SIZE) {
      throw new Error(`Expected ${STATE_SIZE} MT state values, received ${snapshot.state.length}`);
    }

    this.index = snapshot.index;
    this.state = Uint32Array.from(snapshot.state, (value) => value >>> 0);
  }
}

export interface RandomGeneratorOptions {
  readonly seed?: number;
}

export interface RandomGeneratorState {
  readonly mt: MersenneTwisterState;
}

/** nextafterf(1, 0): the largest float below 1. */
const FLOAT_BELOW_ONE = 1 - 2 ** -24;
/** nextafterf(-1, 0) */
const FLOAT_ABOVE_MINUS_ONE = -FLOAT_BELOW_ONE;
const f32 = Math.fround;

/**
 * The random helpers of the rerelease's g_local.h, drawing from std::mt19937 through the
 * distributions of libstdc++ (GCC 13), so a value here is the value the game DLL built with GCC
 * draws:
 *
 * - std::uniform_real_distribution<float> takes one 32-bit sample (generate_canonical with
 *   24 bits), rounds it to a float, divides by 2^32 (a value of 1 becomes the float below 1),
 *   and scales it in float arithmetic: `canonical * (b - a) + a`;
 * - std::uniform_int_distribution takes Lemire's nearly divisionless sample: the high 32 bits
 *   of `sample * range`, drawing again only while the low 32 bits are under `-range % range`.
 *
 * MSVC's distributions (the rerelease's own Windows build) differ; the lockstep oracle is built
 * with GCC, which is what this follows.
 */
export class RandomGenerator {
  private readonly mt: MersenneTwister19937;

  constructor(options: RandomGeneratorOptions = {}) {
    this.mt = new MersenneTwister19937(options.seed);
  }

  seed(seed: number): void {
    this.mt.seed(seed);
  }

  /** std::generate_canonical<float, 24>: a float in [0, 1). */
  private canonical(): number {
    const r = f32(this.mt.nextUint32()) / TWO_POW_32;
    return r >= 1 ? FLOAT_BELOW_ONE : r;
  }

  /** frandom(): uniform float in [0, 1). */
  frandom(): number {
    return this.canonical();
  }

  /** frandom(min, max): uniform float in [min, max). */
  frandomRange(minInclusive: number, maxExclusive: number): number {
    const a = f32(minInclusive);
    return f32(f32(this.canonical() * f32(f32(maxExclusive) - a)) + a);
  }

  /** frandom(max): uniform float in [0, max). */
  frandomMax(maxExclusive: number): number {
    return this.frandomRange(0, maxExclusive);
  }

  /** crandom(): uniform float in [-1, 1). */
  crandom(): number {
    return this.frandomRange(-1, 1);
  }

  /** crandom_open(): uniform float in (-1, 1). */
  crandomOpen(): number {
    return this.frandomRange(FLOAT_ABOVE_MINUS_ONE, 1);
  }

  /** irandom(): a raw uint32 sample. */
  irandomUint32(): number {
    return this.mt.nextUint32();
  }

  /** std::uniform_int_distribution over [min, max] (inclusive), for spans up to 2^32. */
  private uniformInt(min: number, max: number): number {
    const span = max - min + 1;
    if (span >= TWO_POW_32) return min + this.mt.nextUint32();
    // _S_nd: the high half of sample * span, from a 64-bit product
    const range = BigInt(span);
    let product = BigInt(this.mt.nextUint32()) * range;
    let low = Number(product & 0xffffffffn);
    if (low < span) {
      const threshold = (TWO_POW_32 - span) % span;
      while (low < threshold) {
        product = BigInt(this.mt.nextUint32()) * range;
        low = Number(product & 0xffffffffn);
      }
    }
    return min + Number(product >> 32n);
  }

  /** irandom(min, max): uniform integer in [min, max); min when max - min is 1 or less. */
  irandomRange(minInclusive: number, maxExclusive: number): number {
    if (maxExclusive - minInclusive <= 1) {
      return minInclusive;
    }
    return this.uniformInt(minInclusive, maxExclusive - 1);
  }

  /** irandom(max): uniform integer in [0, max); 0 when max is 0 or less. */
  irandom(maxExclusive: number): number {
    if (maxExclusive <= 0) {
      return 0;
    }
    return this.irandomRange(0, maxExclusive);
  }

  /** random_time(min, max): uniform milliseconds in [min, max] (the rerelease passes max to an inclusive distribution). */
  randomTimeRange(minMs: number, maxMs: number): number {
    if (maxMs <= minMs) {
      return minMs;
    }
    return this.uniformInt(minMs, maxMs);
  }

  /** random_time(max): uniform milliseconds in [0, max]. */
  randomTime(maxMs: number): number {
    return this.randomTimeRange(0, maxMs);
  }

  randomIndex<T extends { length: number }>(container: T): number {
    return this.irandom(container.length);
  }

  getState(): RandomGeneratorState {
    return { mt: this.mt.getState() };
  }

  setState(snapshot: RandomGeneratorState): void {
    this.mt.setState(snapshot.mt);
  }
}

export function createRandomGenerator(options?: RandomGeneratorOptions): RandomGenerator {
  return new RandomGenerator(options);
}
