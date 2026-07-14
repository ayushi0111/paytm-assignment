import { DB } from '../db';
import { encodeBase62 } from '../utils/base62';
import { isValidUrl, isValidAlias } from '../utils/urlValidator';
import { normalizeUrl } from '../utils/normalizeUrl';
import { BloomFilter } from '../utils/bloomFilter';
import { ConflictError, InvalidInputError, NotFoundError } from '../errors';
import { UrlRecord } from '../types';

// Purely cosmetic: keeps generated codes from starting at "1", "2", ... and
// makes the underlying row id less obviously guessable. Collision-freedom
// does not depend on this - it comes from base62 being a bijection over a
// unique id (see utils/base62.ts).
const CODE_ID_OFFSET = 1_000_000;

export interface ShortenResult {
  record: UrlRecord;
  alreadyExisted: boolean;
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    err instanceof Error &&
    ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed'))
  );
}

export class UrlService {
  private customAliasFilter: BloomFilter;

  constructor(private db: DB) {
    this.customAliasFilter = this.buildBloomFilterFromDb();
  }

  private buildBloomFilterFromDb(): BloomFilter {
    const rows = this.db.prepare('SELECT code FROM urls WHERE is_custom = 1').all() as { code: string }[];
    const filter = BloomFilter.create(Math.max(rows.length, 100), 0.01);
    rows.forEach((row) => filter.add(row.code));
    return filter;
  }

  shorten(ownerId: number, url: unknown, customAlias?: unknown): ShortenResult {
    if (typeof url !== 'string' || !isValidUrl(url)) {
      throw new InvalidInputError('A valid http(s) URL is required');
    }

    const normalized = normalizeUrl(url);

    if (customAlias !== undefined && customAlias !== null && customAlias !== '') {
      if (typeof customAlias !== 'string' || !isValidAlias(customAlias)) {
        throw new InvalidInputError(
          'Custom alias must be 3-32 URL-safe characters (letters, digits, "-", "_") and not a reserved word'
        );
      }
      return { record: this.insertCustom(ownerId, url, normalized, customAlias), alreadyExisted: false };
    }

    const existing = this.db
      .prepare('SELECT * FROM urls WHERE owner_id = ? AND normalized_url = ?')
      .get(ownerId, normalized) as UrlRecord | undefined;
    if (existing) {
      return { record: existing, alreadyExisted: true };
    }

    return { record: this.insertGenerated(ownerId, url, normalized), alreadyExisted: false };
  }

  private insertCustom(ownerId: number, url: string, normalized: string, alias: string): UrlRecord {
    if (this.customAliasFilter.mightContain(alias)) {
      const taken = this.db.prepare('SELECT id FROM urls WHERE code = ?').get(alias);
      if (taken) {
        throw new ConflictError(`Alias "${alias}" is already taken`);
      }
    }

    try {
      this.db
        .prepare('INSERT INTO urls (code, original_url, normalized_url, is_custom, owner_id) VALUES (?, ?, ?, 1, ?)')
        .run(alias, url, normalized, ownerId);
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        throw new ConflictError(`Alias "${alias}" is already taken`);
      }
      throw err;
    }

    this.customAliasFilter.add(alias);
    return this.getByCode(alias)!;
  }

  private insertGenerated(ownerId: number, url: string, normalized: string): UrlRecord {
    const info = this.db
      .prepare('INSERT INTO urls (code, original_url, normalized_url, is_custom, owner_id) VALUES (NULL, ?, ?, 0, ?)')
      .run(url, normalized, ownerId);

    const id = Number(info.lastInsertRowid);
    const code = encodeBase62(id + CODE_ID_OFFSET);
    this.db.prepare('UPDATE urls SET code = ? WHERE id = ?').run(code, id);

    return this.getByCode(code)!;
  }

  getByCode(code: string): UrlRecord | undefined {
    return this.db.prepare('SELECT * FROM urls WHERE code = ?').get(code) as UrlRecord | undefined;
  }

  /** Looks up a code and records a click against it; used by the redirect route. */
  recordClickAndGet(code: string): UrlRecord | undefined {
    const record = this.getByCode(code);
    if (!record) return undefined;

    this.db
      .prepare("UPDATE urls SET click_count = click_count + 1, last_accessed_at = datetime('now') WHERE id = ?")
      .run(record.id);

    return this.getByCode(code);
  }

  listByOwner(ownerId: number): UrlRecord[] {
    return this.db
      .prepare('SELECT * FROM urls WHERE owner_id = ? ORDER BY created_at DESC')
      .all(ownerId) as UrlRecord[];
  }

  /** 404s (not 403) for links the caller doesn't own, so ownership isn't leaked. */
  getByCodeForOwner(ownerId: number, code: string): UrlRecord {
    const record = this.getByCode(code);
    if (!record || record.owner_id !== ownerId) {
      throw new NotFoundError('Link not found');
    }
    return record;
  }

  update(ownerId: number, code: string, newUrl: unknown): UrlRecord {
    if (typeof newUrl !== 'string' || !isValidUrl(newUrl)) {
      throw new InvalidInputError('A valid http(s) URL is required');
    }

    const record = this.getByCodeForOwner(ownerId, code);
    const normalized = normalizeUrl(newUrl);

    this.db
      .prepare("UPDATE urls SET original_url = ?, normalized_url = ?, updated_at = datetime('now') WHERE id = ?")
      .run(newUrl, normalized, record.id);

    return this.getByCode(code)!;
  }
}
