import fs from 'node:fs/promises';
import path from 'node:path';

// Resolves to apps/taalwiz-api/public/assets/ in both dev (dist/src/...) and prod
export const PUBLIC_ASSETS_DIR = path.join(import.meta.dirname, '../../../../public/assets');

const MANIFEST_PATH = path.join(PUBLIC_ASSETS_DIR, 'dict-manifest.json');
const DICT_FILE_RE = /^[a-z]+\.[a-z]\.json$/;

export async function writeDictManifest(): Promise<void> {
  const entries = await fs.readdir(PUBLIC_ASSETS_DIR);
  const files = entries.filter((name) => DICT_FILE_RE.test(name)).sort();
  const manifest = { version: new Date().toISOString(), files };
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');
}
