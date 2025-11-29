import { WriteStream } from 'fs';
import fs from 'node:fs';
import readline from 'node:readline';
import path from 'path';
import { Parser, ParserResult } from './ParserBase.js';
import TeeuwParser from './TeeuwParser.js';
import VanDaleParser from './VanDaleParser.js';

// Order distance between letter chapters of the dictionary,
// assuming no more than 50,000 lemmas per chapter
const CHAPTER_DISTANCE = 50_000; // 50,000 * 26 = 1,300,000 < 2,000,000

// Offset to be added to the current order for reference words (keyword=0)
// and also for native keywords.
const ORDER_OFFSET = 2_000_000;

interface LineItem {
  lineIndex: number;
  line: string;
}

interface Word {
  word: string;
  lang: string;
  keyword: number;
  order: number;
}

interface Lemma {
  text: string;
  base: string;
  homonym: number;
  words: Word[];
}

export class Compiler {
  private parser: Parser | undefined;

  constructor(
    public inFile: string,
    public outFile: string
  ) {}

  async run(): Promise<void> {
    if (this.inFile.endsWith('teeuw.md')) {
      this.parser = new TeeuwParser();
    } else if (this.inFile.endsWith('vandale.md')) {
      this.parser = new VanDaleParser();
    } else {
      throw new Error(`Skipping unrecognized file: ${this.inFile}`);
    }

    const fileBase = path.basename(this.inFile, '.md').toLowerCase();
    let order = (fileBase.charCodeAt(0) - 'a'.charCodeAt(0)) * CHAPTER_DISTANCE;

    let fsOut: WriteStream | null = null;

    try {
      const fsIn = fs.createReadStream(this.inFile);
      fsOut = fs.createWriteStream(this.outFile);

      fsOut.write(`{"baseLang": "${this.parser.sourceLang}", "lemmas": [\n`);

      const rl = readline.createInterface({
        input: fsIn,
        crlfDelay: Infinity,
      });

      let lineNum = 0;
      let lineItems: LineItem[] = [];
      let needComma = false;

      for await (let line of rl) {
        line = line.trim();
        if (!line) {
          if (lineItems.length > 0) {
            if (needComma) {
              fsOut.write(', ');
            }
            needComma = true;

            order = this.compileLineItems(fsOut, lineItems, order);
            lineItems = [];
            this.parser.reset();
          }
        } else {
          lineItems.push({ line, lineIndex: lineNum });
        }
        lineNum += 1;
      }

      if (lineItems.length > 0) {
        fsOut.write(', ');
        this.compileLineItems(fsOut, lineItems, order);
      }

      fsOut.write(']}\n');

      console.log(path.basename(this.inFile));
    } catch (err: any) {
      console.error(err);
    } finally {
      if (fsOut) {
        fsOut.end();
      }
    }
  }

  compileLineItems(
    fsOut: WriteStream,
    lineItems: LineItem[],
    order: number
  ): number {
    const lemmas: Lemma[] = [];

    for (const { lineIndex, line } of lineItems) {
      try {
        const result = this.parser!.parseLine(line);
        const lemma = this.buildLemma(result, order);
        lemmas.push(lemma);
      } catch (err: any) {
        console.error(
          `${path.basename(this.inFile)} [${lineIndex + 1}]: ${line}\nerror: ${err.message}`
        );
      }
      order += 1;
    }

    this.dumpLemmas(fsOut, lemmas);

    return order;
  }

  buildLemma(result: ParserResult, order: number): Lemma {
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

    for (const word of result.sourceKeywords) {
      lemma.words.push({
        word,
        lang: parser.sourceLang,
        keyword: 1,
        order,
      });
    }

    if (!result.sourceKeywords.has(parser.base)) {
      result.sourceWords.add(parser.base);
    }

    for (const word of result.sourceWords) {
      if (!result.sourceKeywords.has(word)) {
        lemma.words.push({
          word,
          lang: parser.sourceLang,
          keyword: 0,
          order: word === parser.tildeWord ? order : order + ORDER_OFFSET,
        });
      }
    }

    for (const word of result.targetKeywords) {
      lemma.words.push({
        word,
        lang: parser.targetLang,
        keyword: 1,
        order,
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
