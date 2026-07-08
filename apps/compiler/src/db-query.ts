import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DictionaryName, LemmaRecord } from './db-types.js';

export type { LemmaRecord, DictionaryStatistics, ExportedData, DictionaryName } from './db-types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let SQL: Awaited<ReturnType<typeof initSqlJs>>;

async function initSQL() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

export class DictionaryDatabase {
  private db: any;
  private dictName: DictionaryName;
  private ready: Promise<void>;

  constructor(dictName: DictionaryName) {
    this.dictName = dictName;
    this.ready = this.loadDatabase();
  }

  private async loadDatabase() {
    const dbPath = path.join(__dirname, '../', `${this.dictName}.db`);
    if (!fs.existsSync(dbPath)) {
      throw new Error(`Database not found: ${dbPath}`);
    }

    const SQL = await initSQL();
    const filebuffer = fs.readFileSync(dbPath);
    this.db = new SQL.Database(filebuffer);
  }

  private async ensureReady() {
    await this.ready;
    if (!this.db) {
      throw new Error('Database failed to initialize');
    }
  }

  private async queryAll(sql: string, params: any[] = []): Promise<any[]> {
    await this.ensureReady();
    try {
      const result = this.db.exec(sql, params);
      if (!result.length) return [];

      const columns = result[0].columns;
      const values = result[0].values;

      return values.map((row: any[]) => {
        const obj: any = {};
        columns.forEach((col: string, i: number) => {
          obj[col] = row[i];
        });
        return obj;
      });
    } catch (_error) {
      return [];
    }
  }

  /**
   * Look up a lemma by its base word
   */
  async findByBase(base: string): Promise<LemmaRecord[]> {
    const sql = `
      SELECT * FROM lemmas_view WHERE base = ? ORDER BY homonym
    `;
    return this.queryAll(sql, [base]);
  }

  /**
   * Search lemmas by base word prefix
   */
  async searchByBasePrefix(prefix: string, limit = 50): Promise<LemmaRecord[]> {
    const sql = `
      SELECT * FROM lemmas_view
      WHERE base LIKE ?
      ORDER BY base, homonym
      LIMIT ?
    `;
    return this.queryAll(sql, [`${prefix}%`, limit]);
  }

  /**
   * Full-text search across all lemmas and text (simple string matching)
   */
  async fullTextSearch(query: string, limit = 50): Promise<LemmaRecord[]> {
    const searchTerm = `%${query}%`;
    const sql = `
      SELECT DISTINCT l.id, l.letter, l.base, l.homonym, l.text, l.keywords, l.glosses_nl, l.glosses_en, l.created_at
      FROM lemmas_view l
      WHERE l.base LIKE ? OR l.text LIKE ? OR l.keywords LIKE ?
      LIMIT ?
    `;
    return this.queryAll(sql, [searchTerm, searchTerm, searchTerm, limit]);
  }

  /**
   * Find lemmas by a keyword (searched in any language)
   */
  async findByKeyword(word: string): Promise<LemmaRecord[]> {
    const sql = `
      SELECT DISTINCT l.* FROM lemmas_view l
      INNER JOIN words w ON l.id = w.lemma_id
      WHERE w.is_keyword = 1 AND w.word = ?
      ORDER BY l.base, l.homonym
    `;
    return this.queryAll(sql, [word]);
  }

  /**
   * Find lemmas by a keyword with fuzzy matching (starts with)
   */
  async findByKeywordPrefix(word: string, lang?: 'id' | 'nl' | 'en'): Promise<LemmaRecord[]> {
    let sql = `
      SELECT DISTINCT l.* FROM lemmas_view l
      INNER JOIN words w ON l.id = w.lemma_id
      WHERE w.is_keyword = 1 AND w.word LIKE ?
    `;
    const params: any[] = [`${word}%`];

    if (lang) {
      sql += ` AND w.lang = ?`;
      params.push(lang);
    }

    sql += ` ORDER BY l.base, l.homonym LIMIT 50`;

    return this.queryAll(sql, params);
  }

  /**
   * Get all lemmas in a specific chapter
   */
  async getChapter(letter: string): Promise<LemmaRecord[]> {
    const sql = `
      SELECT * FROM lemmas_view WHERE letter = ? ORDER BY base, homonym
    `;
    return this.queryAll(sql, [letter]);
  }

  /**
   * Get statistics about the dictionary
   */
  async getStatistics(): Promise<{
    totalLemmas: number;
    totalWords: number;
    totalChapters: number;
    chapterStats: Array<{ letter: string; lemmaCount: number }>;
  }> {
    const totalLemmasResult = await this.queryAll(`SELECT COUNT(*) as count FROM lemmas`);
    const totalLemmas = totalLemmasResult[0]?.count || 0;

    const totalWordsResult = await this.queryAll(`SELECT COUNT(*) as count FROM words`);
    const totalWords = totalWordsResult[0]?.count || 0;

    const totalChaptersResult = await this.queryAll(`SELECT COUNT(*) as count FROM chapters`);
    const totalChapters = totalChaptersResult[0]?.count || 0;

    const chapterStats = await this.queryAll(`
      SELECT c.letter, COUNT(l.id) as lemmaCount
      FROM chapters c
      LEFT JOIN lemmas l ON c.id = l.chapter_id
      GROUP BY c.id
      ORDER BY c.letter
    `);

    return {
      totalLemmas,
      totalWords,
      totalChapters,
      chapterStats,
    };
  }

  /**
   * Export lemmas as JSON (for a specific chapter or all)
   */
  async exportAsJson(letter?: string): Promise<object> {
    let lemmas: LemmaRecord[];

    if (letter) {
      lemmas = await this.getChapter(letter);
    } else {
      lemmas = await this.queryAll(`SELECT * FROM lemmas_view ORDER BY letter, base, homonym`);
    }

    return {
      exported_at: new Date().toISOString(),
      lemmaCount: lemmas.length,
      lemmas,
    };
  }

  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Utility function to get database instance
 */
export function openDictionary(dictName: DictionaryName): DictionaryDatabase {
  return new DictionaryDatabase(dictName);
}
