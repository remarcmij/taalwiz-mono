#!/usr/bin/env node

/**
 * Simple CLI tool for querying the SQLite dictionaries.
 * Usage:
 *   pnpm run db:cli teeuw lookup makan
 *   pnpm run db:cli stevens search "to eat"
 *   pnpm run db:cli teeuw stats
 */

import { openDictionary } from './db-query.js';

const args = process.argv.slice(2);

if (args.length < 2) {
  console.log(`
Usage: db-cli <dict> <command> [args...]

Dictionaries:
  teeuw    Indonesian-Dutch
  stevens  Indonesian-English

Commands:
  lookup <base>           Look up a lemma by base word
  search <query>          Full-text search
  prefix <prefix>         Search by prefix
  keyword <word>          Find lemmas by keyword
  chapter <letter>        Get all lemmas in a chapter
  stats                   Show dictionary statistics
  export [letter]         Export as JSON (all or by chapter)

Examples:
  db-cli teeuw lookup makan
  db-cli stevens search "to eat"
  db-cli teeuw chapter a
  db-cli teeuw stats
  db-cli stevens export h
`);
  process.exit(1);
}

const dictName = args[0] as 'teeuw' | 'stevens';
const command = args[1];
const commandArgs = args.slice(2);

if (!['teeuw', 'stevens'].includes(dictName)) {
  console.error(`Unknown dictionary: ${dictName}`);
  process.exit(1);
}

async function main() {
  try {
    const dict = openDictionary(dictName);

    switch (command) {
      case 'lookup': {
        if (!commandArgs[0]) {
          console.error('Usage: db-cli <dict> lookup <base>');
          process.exit(1);
        }
        const results = await dict.findByBase(commandArgs[0]);
        console.log(JSON.stringify(results, null, 2));
        break;
      }

      case 'search': {
        if (!commandArgs[0]) {
          console.error('Usage: db-cli <dict> search <query>');
          process.exit(1);
        }
        const results = await dict.fullTextSearch(commandArgs.join(' '));
        console.log(`Found ${results.length} results:\n`);
        console.log(JSON.stringify(results, null, 2));
        break;
      }

      case 'prefix': {
        if (!commandArgs[0]) {
          console.error('Usage: db-cli <dict> prefix <prefix>');
          process.exit(1);
        }
        const results = await dict.searchByBasePrefix(commandArgs[0]);
        console.log(`Found ${results.length} results:\n`);
        results.forEach((r: any) => {
          console.log(`${r.base} (homonym ${r.homonym}): ${r.text.substring(0, 80)}...`);
        });
        break;
      }

      case 'keyword': {
        if (!commandArgs[0]) {
          console.error('Usage: db-cli <dict> keyword <word>');
          process.exit(1);
        }
        const results = await dict.findByKeyword(commandArgs[0]);
        console.log(`Found ${results.length} results:\n`);
        console.log(JSON.stringify(results, null, 2));
        break;
      }

      case 'chapter': {
        if (!commandArgs[0]) {
          console.error('Usage: db-cli <dict> chapter <letter>');
          process.exit(1);
        }
        const results = await dict.getChapter(commandArgs[0]);
        console.log(`Found ${results.length} lemmas in chapter ${commandArgs[0]}:\n`);
        results.forEach((r: any) => {
          console.log(`${r.base} (${r.homonym}): ${r.text.substring(0, 60)}...`);
        });
        break;
      }

      case 'stats': {
        const stats = await dict.getStatistics();
        console.log('Dictionary Statistics:');
        console.log(`  Total lemmas: ${stats.totalLemmas.toLocaleString()}`);
        console.log(`  Total words: ${stats.totalWords.toLocaleString()}`);
        console.log(`  Total chapters: ${stats.totalChapters}`);
        console.log('\nBy chapter:');
        stats.chapterStats.forEach((s: any) => {
          console.log(`  ${s.letter}: ${s.lemmaCount} lemmas`);
        });
        break;
      }

      case 'export': {
        const letter = commandArgs[0];
        const json = await dict.exportAsJson(letter);
        console.log(JSON.stringify(json, null, 2));
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        process.exit(1);
    }

    dict.close();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
