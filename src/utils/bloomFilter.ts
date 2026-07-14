function fnv1aHash(value: string, seed: number): number {
  let hash = seed >>> 0;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * A minimal Bloom filter. mightContain() never false-negatives (if an item
 * was added, it always reports present) but can false-positive. It is used
 * here purely as a fast pre-check to skip a DB round-trip when a custom
 * alias is definitely free; the DB's UNIQUE(code) constraint remains the
 * actual source of truth for uniqueness.
 */
export class BloomFilter {
  private readonly bits: Uint8Array;
  private readonly size: number;
  private readonly hashCount: number;

  constructor(size: number, hashCount: number) {
    if (size <= 0 || hashCount <= 0) {
      throw new Error('BloomFilter size and hashCount must be positive');
    }
    this.size = size;
    this.hashCount = hashCount;
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  /** Sizes a filter from the expected item count and a target false-positive rate. */
  static create(expectedItems: number, falsePositiveRate = 0.01): BloomFilter {
    const n = Math.max(1, expectedItems);
    const m = Math.max(8, Math.ceil(-(n * Math.log(falsePositiveRate)) / Math.LN2 ** 2));
    const k = Math.max(1, Math.round((m / n) * Math.LN2));
    return new BloomFilter(m, k);
  }

  private indicesFor(value: string): number[] {
    // Kirsch-Mitzenmacher: derive k indices from two independent hashes
    // instead of computing k separate hash functions.
    const h1 = fnv1aHash(value, 0x811c9dc5);
    const h2 = fnv1aHash(value, 0x01000193);
    const indices: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      indices.push(((h1 + i * h2) >>> 0) % this.size);
    }
    return indices;
  }

  add(value: string): void {
    for (const index of this.indicesFor(value)) {
      this.bits[index >> 3] |= 1 << (index % 8);
    }
  }

  mightContain(value: string): boolean {
    return this.indicesFor(value).every((index) => (this.bits[index >> 3] & (1 << (index % 8))) !== 0);
  }
}
