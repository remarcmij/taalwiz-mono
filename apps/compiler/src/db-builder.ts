import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Word {
  word: string;
  lang: 'id' | 'nl' | 'en';
  keyword: number;
}

interface Lemma {
  text: string;
  base: string;
  homonym: number;
  words: Word[];
}

interface ChapterData {
  targetLang: string;
  lemmas: Lemma[];
}

const CHAPTER_LETTERS = [
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
  'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
];

async function buildDatabase(dictName: 'teeuw' | 'stevens') {
  const jsonDir = path.join(__dirname, '../json', dictName);
  const dbPath = path.join(__dirname, '../', `${dictName}.db`);

  // Initialize SQL.js
  const SQL = await initSqlJs();
  const db = new SQL.Database();

  // Create tables
  db.run(`
    CREATE TABLE chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      letter TEXT NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE lemmas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL,
      base TEXT NOT NULL,
      homonym INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(chapter_id) REFERENCES chapters(id),
      UNIQUE(chapter_id, base, homonym)
    );

    CREATE TABLE words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma_id INTEGER NOT NULL,
      word TEXT NOT NULL,
      lang TEXT NOT NULL,
      is_keyword INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(lemma_id) REFERENCES lemmas(id)
    );

    CREATE INDEX idx_lemmas_base ON lemmas(base);
    CREATE INDEX idx_words_word ON words(word);
    CREATE INDEX idx_words_word_lang ON words(word, lang);
    CREATE INDEX idx_words_is_keyword ON words(is_keyword);
  `);

  console.log(`Building ${dictName} database...`);

  // Load chapters
  let totalLemmas = 0;
  let totalWords = 0;

  for (const letter of CHAPTER_LETTERS) {
    const jsonFile = path.join(jsonDir, `${dictName}.${letter}.json`);

    if (!fs.existsSync(jsonFile)) {
      continue;
    }

    try {
      const content = fs.readFileSync(jsonFile, 'utf-8');
      const data: ChapterData = JSON.parse(content);

      // Insert chapter
      db.run(
        `INSERT INTO chapters (letter) VALUES (?)`,
        [letter],
      );

      // Get last insert ID (sql.js doesn't return it directly, so we query)
      const chapterQueryResult = db.exec(
        `SELECT id FROM chapters WHERE letter = ?`,
        [letter],
      );
      const chapterId = chapterQueryResult[0]?.values[0]?.[0] as number;

      // Insert lemmas and words
      for (const lemma of data.lemmas) {
        try {
          // Use INSERT OR IGNORE to skip duplicates
          db.run(
            `INSERT OR IGNORE INTO lemmas (chapter_id, base, homonym, text) VALUES (?, ?, ?, ?)`,
            [chapterId, lemma.base, lemma.homonym, lemma.text],
          );

          // Get lemma ID
          const lemmaQueryResult = db.exec(
            `SELECT id FROM lemmas WHERE chapter_id = ? AND base = ? AND homonym = ?`,
            [chapterId, lemma.base, lemma.homonym],
          );
          const lemmaId = lemmaQueryResult[0]?.values[0]?.[0] as number;

          if (lemmaId) {
            // Check if this lemma already has words to avoid duplicate word inserts
            const existingWordsResult = db.exec(
              `SELECT COUNT(*) as count FROM words WHERE lemma_id = ?`,
              [lemmaId],
            );
            const existingWordCount = existingWordsResult[0]?.values[0]?.[0] as number;

            // Only insert words if none exist yet (handles duplicate lemmas)
            if (existingWordCount === 0) {
              for (const w of lemma.words) {
                db.run(
                  `INSERT INTO words (lemma_id, word, lang, is_keyword) VALUES (?, ?, ?, ?)`,
                  [lemmaId, w.word, w.lang, w.keyword],
                );
                totalWords++;
              }
            }

            totalLemmas++;
          }
        } catch (_error) {
          // Silently skip errors (likely duplicate entries in source data)
        }
      }

      console.log(`  Loaded chapter ${letter} (${data.lemmas.length} lemmas)`);
    } catch (error) {
      console.error(`Failed to load chapter ${letter}:`, error);
    }
  }

  // Create view for convenience
  db.run(`
    CREATE VIEW lemmas_view AS
    SELECT
      l.id,
      c.letter,
      l.base,
      l.homonym,
      l.text,
      GROUP_CONCAT(CASE WHEN w.is_keyword = 1 THEN w.word ELSE NULL END, ' | ') as keywords,
      GROUP_CONCAT(CASE WHEN w.lang = 'nl' THEN w.word ELSE NULL END, ' | ') as glosses_nl,
      GROUP_CONCAT(CASE WHEN w.lang = 'en' THEN w.word ELSE NULL END, ' | ') as glosses_en,
      l.created_at
    FROM lemmas l
    JOIN chapters c ON l.chapter_id = c.id
    LEFT JOIN words w ON l.id = w.lemma_id
    GROUP BY l.id;
  `);

  // Export database to file
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
  db.close();

  console.log(`✓ Database created: ${dbPath}`);
  console.log(`  Total lemmas: ${totalLemmas.toLocaleString()}`);
  console.log(`  Total words: ${totalWords.toLocaleString()}`);

  return dbPath;
}

async function main() {
  try {
    await buildDatabase('teeuw');
    await buildDatabase('stevens');
    console.log('\n✓ All databases built successfully!');
  } catch (error) {
    console.error('Failed to build databases:', error);
    process.exitCode = 1;
  }
}

main();
