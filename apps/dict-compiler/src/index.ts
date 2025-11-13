import { glob } from 'glob';
import path from 'path';
import { fileURLToPath } from 'url';
import { Compiler } from './compiler/Compiler.js';
import { IParser } from './compiler/ParserBase.js';
import TeeuwParser from './compiler/TeeuwParser.js';
import VanDaleParser from './compiler/VanDaleParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DICT_PATH = '../data';
const DEST_PATH = '../json';

async function main() {
  const globPattern = path
    .join(__dirname, DICT_PATH, '**/*.md')
    .replace(/\\/g, '/');

  const startTime = process.hrtime();

  const filenames = await glob(globPattern);

  const promises = filenames.map(async (inFile) => {
    let parser: IParser | null = null;
    if (inFile.endsWith('teeuw.md')) {
      parser = new TeeuwParser();
    } else if (inFile.endsWith('vandale.md')) {
      parser = new VanDaleParser();
    }
    if (!parser) {
      throw new Error(`Unrecognized file extension for file: ${inFile}`);
    }

    const stem = path.basename(inFile, '.md').toLowerCase();
    const outFile = path.join(__dirname, DEST_PATH, `${stem}.json`);
    const compiler = new Compiler(inFile, outFile);
    await compiler.run();
  });

  await Promise.all(promises);

  const [s, ns] = process.hrtime(startTime);
  const ms = s * 1000 + ns / 1000000;
  console.log(`Total elapsed time: ${ms.toFixed(0)}ms`);
}

main();
