import { BloomFilter } from '../../src/utils/bloomFilter';

describe('BloomFilter', () => {
  it('never false-negatives for added items', () => {
    const filter = BloomFilter.create(1000, 0.01);
    const items = Array.from({ length: 1000 }, (_, i) => `alias-${i}`);
    items.forEach((item) => filter.add(item));

    for (const item of items) {
      expect(filter.mightContain(item)).toBe(true);
    }
  });

  it('keeps the false-positive rate close to the configured target', () => {
    const targetRate = 0.01;
    const filter = BloomFilter.create(1000, targetRate);
    const added = Array.from({ length: 1000 }, (_, i) => `added-${i}`);
    added.forEach((item) => filter.add(item));

    const notAdded = Array.from({ length: 5000 }, (_, i) => `not-added-${i}`);
    const falsePositives = notAdded.filter((item) => filter.mightContain(item)).length;
    const observedRate = falsePositives / notAdded.length;

    // Generous margin over the nominal 1% target to avoid flaking on hash luck.
    expect(observedRate).toBeLessThan(0.05);
  });

  it('reports items definitely absent when the filter is empty', () => {
    const filter = BloomFilter.create(100, 0.01);
    expect(filter.mightContain('never-added')).toBe(false);
  });

  it('rejects a non-positive size or hash count', () => {
    expect(() => new BloomFilter(0, 1)).toThrow();
    expect(() => new BloomFilter(10, 0)).toThrow();
  });
});
