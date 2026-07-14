import { createDatabase } from '../../src/db';
import { UserService } from '../../src/services/userService';
import { UrlService } from '../../src/services/urlService';
import { ConflictError, InvalidInputError, NotFoundError } from '../../src/errors';

describe('UrlService', () => {
  let urlService: UrlService;
  let ownerA: number;
  let ownerB: number;

  beforeEach(async () => {
    const db = createDatabase(':memory:');
    const userService = new UserService(db);
    urlService = new UrlService(db);

    ownerA = userService.findByApiKey((await userService.signup('a@example.com', 'password123')).apiKey)!.id;
    ownerB = userService.findByApiKey((await userService.signup('b@example.com', 'password123')).apiKey)!.id;
  });

  describe('shorten', () => {
    it('generates a URL-safe code for a new link', () => {
      const { record, alreadyExisted } = urlService.shorten(ownerA, 'https://example.com/a');
      expect(record.code).toMatch(/^[0-9a-zA-Z]+$/);
      expect(alreadyExisted).toBe(false);
    });

    it('returns the same code idempotently for the same owner + URL', () => {
      const first = urlService.shorten(ownerA, 'https://Example.com/a');
      const second = urlService.shorten(ownerA, 'https://example.com/a');
      expect(second.record.code).toBe(first.record.code);
      expect(second.alreadyExisted).toBe(true);
    });

    it('gives two different owners independent codes for the same URL', () => {
      const a = urlService.shorten(ownerA, 'https://example.com/shared');
      const b = urlService.shorten(ownerB, 'https://example.com/shared');
      expect(a.record.code).not.toBe(b.record.code);
      expect(b.alreadyExisted).toBe(false);
    });

    it('creates a custom alias', () => {
      const { record } = urlService.shorten(ownerA, 'https://example.com/b', 'my-alias');
      expect(record.code).toBe('my-alias');
      expect(record.is_custom).toBe(1);
    });

    it('rejects a duplicate custom alias', () => {
      urlService.shorten(ownerA, 'https://example.com/c', 'taken');
      expect(() => urlService.shorten(ownerB, 'https://example.com/d', 'taken')).toThrow(ConflictError);
    });

    it('rejects an invalid URL', () => {
      expect(() => urlService.shorten(ownerA, 'not a url')).toThrow(InvalidInputError);
    });

    it('rejects an invalid alias format', () => {
      expect(() => urlService.shorten(ownerA, 'https://example.com/e', 'ab')).toThrow(InvalidInputError);
    });

    it('generates collision-free codes across many links', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const { record } = urlService.shorten(ownerA, `https://example.com/item-${i}`);
        expect(codes.has(record.code)).toBe(false);
        codes.add(record.code);
      }
    });
  });

  describe('recordClickAndGet', () => {
    it('increments click_count and sets last_accessed_at', () => {
      const { record } = urlService.shorten(ownerA, 'https://example.com/f');
      expect(record.click_count).toBe(0);

      urlService.recordClickAndGet(record.code);
      const afterOne = urlService.recordClickAndGet(record.code)!;

      expect(afterOne.click_count).toBe(2);
      expect(afterOne.last_accessed_at).not.toBeNull();
    });

    it('returns undefined for an unknown code', () => {
      expect(urlService.recordClickAndGet('nope')).toBeUndefined();
    });
  });

  describe('listByOwner', () => {
    it('only returns links owned by the given owner', () => {
      urlService.shorten(ownerA, 'https://example.com/g');
      urlService.shorten(ownerB, 'https://example.com/h');

      const ownerALinks = urlService.listByOwner(ownerA);
      expect(ownerALinks).toHaveLength(1);
      expect(ownerALinks[0].original_url).toBe('https://example.com/g');
    });
  });

  describe('getByCodeForOwner', () => {
    it('throws NotFoundError for a code owned by someone else', () => {
      const { record } = urlService.shorten(ownerA, 'https://example.com/i');
      expect(() => urlService.getByCodeForOwner(ownerB, record.code)).toThrow(NotFoundError);
    });

    it('throws NotFoundError for an unknown code', () => {
      expect(() => urlService.getByCodeForOwner(ownerA, 'nope')).toThrow(NotFoundError);
    });
  });

  describe('update', () => {
    it("updates a link's destination URL and updated_at, leaving code/click_count alone", () => {
      const { record } = urlService.shorten(ownerA, 'https://example.com/j');
      urlService.recordClickAndGet(record.code);

      const updated = urlService.update(ownerA, record.code, 'https://example.com/new-destination');

      expect(updated.code).toBe(record.code);
      expect(updated.click_count).toBe(1);
      expect(updated.original_url).toBe('https://example.com/new-destination');
      expect(updated.updated_at).not.toBeNull();
    });

    it('throws NotFoundError when updating a link owned by someone else', () => {
      const { record } = urlService.shorten(ownerA, 'https://example.com/k');
      expect(() => urlService.update(ownerB, record.code, 'https://example.com/hijack')).toThrow(NotFoundError);
    });

    it('rejects an invalid new URL', () => {
      const { record } = urlService.shorten(ownerA, 'https://example.com/l');
      expect(() => urlService.update(ownerA, record.code, 'not a url')).toThrow(InvalidInputError);
    });
  });
});
