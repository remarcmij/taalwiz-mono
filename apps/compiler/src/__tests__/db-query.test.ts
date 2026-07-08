import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDictionary, DictionaryDatabase } from '../db-query.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('DictionaryDatabase', () => {
  let teeuw: DictionaryDatabase;
  let stevens: DictionaryDatabase;

  beforeAll(() => {
    // Check if databases exist; skip tests if not
    const teeuwPath = path.join(__dirname, '../../teeuw.db');
    const stevensPath = path.join(__dirname, '../../stevens.db');

    if (!fs.existsSync(teeuwPath) || !fs.existsSync(stevensPath)) {
      console.warn('Databases not found. Run `pnpm run build:dbs` first.');
      return;
    }

    teeuw = openDictionary('teeuw');
    stevens = openDictionary('stevens');
  });

  afterAll(() => {
    if (teeuw) teeuw.close();
    if (stevens) stevens.close();
  });

  it('should find lemmas by base word', async () => {
    if (!teeuw) return;

    const results = await teeuw.findByBase('makan');
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      expect(results[0]).toHaveProperty('base', 'makan');
      expect(results[0]).toHaveProperty('text');
      expect(results[0]).toHaveProperty('letter');
    }
  });

  it('should search by prefix', async () => {
    if (!teeuw) return;

    const results = await teeuw.searchByBasePrefix('mak', 10);
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      results.forEach((r: any) => {
        expect(r.base.toLowerCase()).toMatch(/^mak/);
      });
    }
  });

  it('should find lemmas by keyword', async () => {
    if (!teeuw) return;

    // Try to find a keyword that exists
    const results = await teeuw.findByKeyword('eten');
    expect(Array.isArray(results)).toBe(true);
  });

  it('should get all lemmas in a chapter', async () => {
    if (!teeuw) return;

    const results = await teeuw.getChapter('a');
    expect(Array.isArray(results)).toBe(true);

    if (results.length > 0) {
      results.forEach((r: any) => {
        expect(r.letter).toBe('a');
      });
    }
  });

  it('should return statistics', async () => {
    if (!teeuw) return;

    const stats = await teeuw.getStatistics();
    expect(stats).toHaveProperty('totalLemmas');
    expect(stats).toHaveProperty('totalWords');
    expect(stats).toHaveProperty('totalChapters');
    expect(stats).toHaveProperty('chapterStats');

    expect(typeof stats.totalLemmas).toBe('number');
    expect(stats.totalLemmas).toBeGreaterThan(0);
    expect(Array.isArray(stats.chapterStats)).toBe(true);
  });

  it('should export as JSON', async () => {
    if (!teeuw) return;

    const json = await teeuw.exportAsJson('a');
    expect(json).toHaveProperty('exported_at');
    expect(json).toHaveProperty('lemmaCount');
    expect(json).toHaveProperty('lemmas');
    expect(Array.isArray((json as any).lemmas)).toBe(true);
  });

  it('should perform full-text search on stevens', async () => {
    if (!stevens) return;

    const results = await stevens.fullTextSearch('to eat', 10);
    expect(Array.isArray(results)).toBe(true);
  });

  it('should handle case-insensitive searches', async () => {
    if (!teeuw) return;

    const lowerResults = await teeuw.findByBase('makan');
    const upperResults = await teeuw.findByBase('MAKAN');

    // Both should work or both should return empty
    expect(lowerResults.length === upperResults.length).toBe(true);
  });
});
