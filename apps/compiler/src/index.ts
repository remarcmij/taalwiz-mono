import { glob } from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Compiler } from './compiler/Compiler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Compile straight from the git-tracked canonical source in the sibling
// taalwiz-content repo (dict/teeuw + dict/stevens); fall back to this package's
// local copies only if that repo isn't checked out alongside. Override with
// DICT_DIR (a dict root that contains teeuw/ and/or stevens/).
const contentDict = path.resolve(__dirname, '../../../../taalwiz-content/dict');
const dictPath =
  process.env.DICT_DIR ??
  (fs.existsSync(contentDict) ? contentDict : path.join(__dirname, '../dict'));
const destPath = path.join(__dirname, '../json');

async function main() {
  fs.mkdirSync(destPath, { recursive: true });

  // Only teeuw/ and stevens/ have a parser (parser-registry); scoping the glob
  // to them keeps a stray sibling dir from duplicating output or failing to
  // parse.
  console.log(`Source: ${dictPath}`);
  const globPattern = path
    .join(dictPath, '{teeuw,stevens}/**/*.md')
    .replace(/\\/g, '/');

  const startTime = process.hrtime();

  const filenames = await glob(globPattern);

  // Group source files by output chapter so a core file (`teeuw.a.md`) and its
  // supplement (`teeuw.a+.md`) compile into one `teeuw.a.json`. The output stem
  // is the basename with any trailing `+` stripped.
  const groups = new Map<string, string[]>();
  for (const inFile of filenames) {
    const stem = path.basename(inFile, '.md').toLowerCase();
    const outStem = stem.replace(/\+$/, '');
    const group = groups.get(outStem) ?? [];
    group.push(inFile);
    groups.set(outStem, group);
  }

  const promises = [...groups].map(([outStem, inFiles]) => {
    // Core (no `+`) before supplement, so homonyms continue from the core.
    inFiles.sort((a, b) => Number(/\+\.md$/i.test(a)) - Number(/\+\.md$/i.test(b)));
    const outFile = path.join(destPath, `${outStem}.json`);
    return new Compiler(inFiles, outFile).run();
  });

  await Promise.all(promises);

  const [s, ns] = process.hrtime(startTime);
  const ms = s * 1000 + ns / 1000000;
  console.log(`Total elapsed time: ${ms.toFixed(0)}ms`);
}

main();
