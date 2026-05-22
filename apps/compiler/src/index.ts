import { glob } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from './compiler/Compiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dictPath = path.join(__dirname, '../dict');
const destPath = path.join(__dirname, '../json');

async function main() {
  fs.mkdirSync(destPath, { recursive: true });

  const globPattern = path.join(dictPath, '**/*.md').replace(/\\/g, '/');

  const startTime = process.hrtime();

  const filenames = await glob(globPattern);

  const promises = filenames.map((inFile) => {
    const stem = path.basename(inFile, '.md').toLowerCase();
    const outFile = path.join(destPath, `${stem}.json`);
    const compiler = new Compiler(inFile, outFile);
    return compiler.run();
  });

  await Promise.all(promises);

  const [s, ns] = process.hrtime(startTime);
  const ms = s * 1000 + ns / 1000000;
  console.log(`Total elapsed time: ${ms.toFixed(0)}ms`);
}

main();
