/**
 * Type definitions for SQLite dictionary databases.
 * These types correspond to the schema created by db-builder.ts
 */

export interface Chapter {
  id: number;
  letter: string;
  created_at: string;
}

export interface LemmaRecord {
  id: number;
  base: string;
  homonym: number;
  text: string;
  chapter_id: number;
  created_at: string;
}

export interface Word {
  id: number;
  lemma_id: number;
  word: string;
  lang: 'id' | 'nl' | 'en';
  is_keyword: number; // SQLite uses 0/1 for boolean
  created_at: string;
}

export interface LemmaViewRecord {
  id: number;
  letter: string;
  base: string;
  homonym: number;
  text: string;
  keywords?: string;
  glosses_nl?: string;
  glosses_en?: string;
  created_at: string;
}

export interface DictionaryStatistics {
  totalLemmas: number;
  totalWords: number;
  totalChapters: number;
  chapterStats: Array<{
    letter: string;
    lemmaCount: number;
  }>;
}

export interface ExportedData {
  exported_at: string;
  lemmaCount: number;
  lemmas: LemmaViewRecord[];
}

export type DictionaryName = 'teeuw' | 'stevens';
