import { WriteStream } from 'fs';
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';
import { finished } from 'node:stream/promises';
import { Parser, ParserResult } from './ParserBase.js';
import { parserRegistry } from './parser-registry.js';

interface LineItem {
  lineIndex: number;
  line: string;
}

interface Word {
  word: string;
  lang: string;
  keyword: number;
}

interface Lemma {
  text: string;
  base: string;
  homonym: number;
  words: Word[];
  // Present only for lemmas sourced from a supplement (`teeuw.a+.md`) file, so
  // the client can mark post-1996 additions distinctly. Omitted for core
  // entries, keeping their JSON byte-identical to a single-file compile.
  isSupplement?: true;
}

// Captures the dictionary name (group 1) and chapter letter (group 2). A
// trailing `+` (group 3) marks a supplement file (`teeuw.a+.md`), whose lemmas
// compile into the same chapter JSON as the core file and carry `isSupplement`.
const fileNameRegExp = /[\\/]([a-z]+)\.([a-z])(\+?)\.md$/;

// Normalizes a headword for the alphabetical-order check: strip diacritics,
// lowercase, drop everything that isn't a letter or digit (so spaces, hyphens,
// apostrophes, and case don't affect ordering — letter-by-letter collation).
const normalizeForOrder = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');

export class Compiler {
  private parser: Parser | undefined;
  private inFiles: string[];
  private outFile: string;
  // Set per input file in run(); buildLemma() reads it to stamp supplements.
  private isSupplement = false;
  // Headword validation (alphabetical order + leading letter), opt-in per parser
  // (see parser-registry). For a dictionary generated from a correctly-ordered
  // PDF, a violation marks a conversion artifact.
  private validateHeadwords = false;
  private prevHeadword: string | null = null;
  private prevHeadwordNorm: string | null = null;
  // Basename + chapter letter of the file currently being read, so warnings name
  // their chapter (chapters compile in parallel, so a bare line number is
  // ambiguous) and the leading-letter check knows the expected letter.
  private currentFile = '';
  private chapterLetter = '';

  constructor(inFiles: string | string[], outFile: string) {
    this.inFiles = Array.isArray(inFiles) ? inFiles : [inFiles];
    this.outFile = outFile;
  }

  async run(): Promise<void> {
    let fsOut: WriteStream | null = null;
    // Tracks the file currently being read so error messages stay specific when
    // a chapter is compiled from more than one source file (core + supplement).
    let currentBaseName = path.basename(this.inFiles[0]);

    try {
      const match = this.inFiles[0].toLowerCase().match(fileNameRegExp);
      if (!match || match.length < 4) {
        throw new Error(`ill-formed filename: ${currentBaseName}`);
      }

      const dictName = match[1];

      const entry = parserRegistry.find(({ prefix }) => dictName.startsWith(prefix));
      if (!entry) {
        throw new Error(`Skipping unrecognized file: ${currentBaseName}`);
      }
      this.parser = entry.factory();
      this.validateHeadwords = entry.validateHeadwords ?? false;

      fsOut = fs.createWriteStream(this.outFile);
      fsOut.write(`{"targetLang": "${this.parser.sourceLang}", "lemmas": [\n`);

      // Compile each source file into the same stream, sharing the parser so
      // homonym numbering carries across the core -> supplement boundary.
      let needComma = false;
      for (const inFile of this.inFiles) {
        currentBaseName = path.basename(inFile);
        this.isSupplement = /\+\.md$/i.test(inFile);
        needComma = await this.compileFile(inFile, fsOut, needComma);
      }

      fsOut.write(']}\n');
      fsOut.end();
      await finished(fsOut);
      fsOut = null;

      console.log(this.inFiles.map((f) => path.basename(f)).join(' + '));
    } catch (err: any) {
      if (err instanceof Error) {
        console.error(`Error processing file '${currentBaseName}': ${err.message}`);
      } else {
        console.error(`Unknown error processing file '${currentBaseName}'`);
      }
      if (fsOut) {
        fsOut.end();
        try {
          await finished(fsOut);
          fs.unlinkSync(this.outFile);
        } catch (unlinkErr) {
          console.error(`Could not delete malformed file ${this.outFile}: ${unlinkErr}`);
        }
        fsOut = null;
      }
    } finally {
      if (fsOut) {
        fsOut.end();
      }
    }
  }

  // Reads one source file, streaming its lemma groups into the shared output.
  // `needComma` is threaded in and out so commas are placed correctly across
  // group and file boundaries. The parser is intentionally NOT recreated, so a
  // supplement entry continuing the previous file's headword keeps numbering.
  private async compileFile(
    inFile: string,
    fsOut: WriteStream,
    needComma: boolean,
  ): Promise<boolean> {
    const rl = readline.createInterface({
      input: fs.createReadStream(inFile),
      crlfDelay: Infinity,
    });

    let lineNum = 0;
    let lineItems: LineItem[] = [];

    this.currentFile = path.basename(inFile);
    this.chapterLetter = this.currentFile.match(/\.([a-z])\+?\.md$/)?.[1] ?? '';

    // Alphabetical order is checked per file, so a new chapter (or a Teeuw
    // supplement restarting at 'a') doesn't warn against the previous file.
    this.prevHeadword = null;
    this.prevHeadwordNorm = null;

    const flush = () => {
      if (needComma) {
        fsOut.write(', ');
      }
      needComma = true;
      this.compileLineItems(fsOut, lineItems);
      lineItems = [];
      this.parser!.reset();
    };

    for await (let line of rl) {
      line = line.trim();
      if (line.startsWith('//')) {
        // Source comment: ignored entirely, and does not break the surrounding
        // block (it is not treated as a blank-line separator).
      } else if (!line) {
        if (lineItems.length > 0) {
          flush();
        }
      } else {
        lineItems.push({ line, lineIndex: lineNum });
      }
      lineNum += 1;
    }

    if (lineItems.length > 0) {
      flush();
    }

    return needComma;
  }

  compileLineItems(fsOut: WriteStream, lineItems: LineItem[]): void {
    const lemmas: Lemma[] = [];

    for (const { lineIndex, line } of lineItems) {
      try {
        if (line === '^') {
          // Tilde-revert marker on its own line: reset `~` to the base,
          // emit no lemma.
          this.parser!.revertTildeToBase();
          continue;
        }
        let text = line;
        if (text.startsWith('^')) {
          // Tilde-revert marker as a sublemma prefix: revert, then parse the
          // rest of the line normally (the `^` is not stored in the lemma).
          this.parser!.revertTildeToBase();
          text = text.slice(1).trimStart();
        }
        const result = this.parser!.parseLine(text);
        if (result.warning) {
          console.warn(`${this.currentFile}[${lineIndex + 1}] warning: ${result.warning}`);
        }
        const lemma = this.buildLemma(result);
        lemmas.push(lemma);
      } catch (err: any) {
        throw new Error(`[${lineIndex + 1}] ${err.message}`);
      }
    }

    this.validateHeadword(lineItems);
    this.dumpLemmas(fsOut, lemmas);
  }

  // Warns (non-fatal) about a block's headword when the parser opts in (Stevens,
  // not Teeuw). Two rules — for a dictionary built from a correctly-ordered PDF,
  // either failure is a conversion artifact:
  //   1. it precedes the previous headword alphabetically (misordered);
  //   2. it does not start with the chapter's letter (an intruder/mangled entry).
  // Equal-to-previous (a homonym / re-filed same word) is fine for rule 1.
  private validateHeadword(lineItems: LineItem[]): void {
    if (!this.validateHeadwords) return;

    const base = this.parser!.base;
    if (!base || lineItems.length === 0) return;

    const norm = normalizeForOrder(base);
    if (!norm) return;

    const at = `${this.currentFile}[${lineItems[0].lineIndex + 1}]`;

    if (this.chapterLetter && norm[0] !== this.chapterLetter) {
      console.warn(
        `${at} warning: headword "${base}" does not start with the chapter ` +
          `letter "${this.chapterLetter}"`,
      );
    }

    if (this.prevHeadwordNorm !== null && norm < this.prevHeadwordNorm) {
      console.warn(
        `${at} warning: headword "${base}" is out of alphabetical order ` +
          `(after "${this.prevHeadword}")`,
      );
    }

    this.prevHeadword = base;
    this.prevHeadwordNorm = norm;
  }

  buildLemma(result: ParserResult): Lemma {
    const parser = this.parser!;

    if (!parser.base) {
      throw new Error('base undefined');
    }

    const lemma: Lemma = {
      text: result.line,
      base: parser.base,
      homonym: parser.homonym,
      words: [],
    };

    if (this.isSupplement) {
      lemma.isSupplement = true;
    }

    for (const word of result.sourceKeywords) {
      lemma.words.push({
        word,
        lang: parser.sourceLang,
        keyword: 1,
      });
    }

    if (!result.sourceKeywords.has(parser.base)) {
      result.referenceWords.add(parser.base);
    }

    for (const word of result.referenceWords) {
      if (!result.sourceKeywords.has(word)) {
        lemma.words.push({
          word,
          lang: parser.sourceLang,
          keyword: 0,
        });
      }
    }

    for (const word of result.targetWords) {
      lemma.words.push({
        word,
        lang: parser.targetLang,
        keyword: 1,
      });
    }

    return lemma;
  }

  dumpLemmas(fsOut: WriteStream, lemmas: Lemma[]) {
    let needComma = false;

    for (const lemma of lemmas) {
      if (needComma) {
        fsOut.write(', ');
      }
      needComma = true;

      const jsonString = JSON.stringify(lemma);
      fsOut.write(jsonString);
    }
  }
}
