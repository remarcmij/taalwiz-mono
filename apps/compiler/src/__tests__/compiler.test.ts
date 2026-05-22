import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Compiler } from '../compiler/Compiler.js';

describe('Compiler', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taalwiz-compiler-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('compiles a two-group Teeuw dict file to correct JSON', async () => {
    // 'I' is filtered (ABBREVIATIONS_NL), so eeuw and tijdperk are the only target keywords.
    // The digit-continuation line triggers TeeuwParser's tilde-word prepend logic.
    const input = [
      '**abad** I, eeuw, tijdperk',
      '2 tijd, periode',
      '',
      '**adat**, gewoonte, gebruik',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const dict = JSON.parse(fs.readFileSync(outFile, 'utf8'));

    expect(dict.targetLang).toBe('id');
    expect(dict.lemmas).toHaveLength(3);

    const [abad1, abad2, adat] = dict.lemmas;

    // first lemma: heading line
    expect(abad1.text).toBe('**abad** I, eeuw, tijdperk');
    expect(abad1.base).toBe('abad');
    expect(abad1.homonym).toBe(0);
    expect(abad1.words).toContainEqual(
      expect.objectContaining({ word: 'abad', lang: 'id', keyword: 1 })
    );
    expect(abad1.words).toContainEqual(
      expect.objectContaining({ word: 'eeuw', lang: 'nl', keyword: 1 })
    );
    expect(abad1.words).toContainEqual(
      expect.objectContaining({ word: 'tijdperk', lang: 'nl', keyword: 1 })
    );

    // second lemma: digit-continuation line — tilde word is prepended as ** heading
    expect(abad2.text).toBe('**abad**, 2 tijd, periode');
    expect(abad2.base).toBe('abad');
    expect(abad2.words).toContainEqual(
      expect.objectContaining({ word: 'abad', lang: 'id', keyword: 1 })
    );
    expect(abad2.words).toContainEqual(
      expect.objectContaining({ word: 'tijd', lang: 'nl', keyword: 1 })
    );
    expect(abad2.words).toContainEqual(
      expect.objectContaining({ word: 'periode', lang: 'nl', keyword: 1 })
    );

    // third lemma: second group, different base word
    expect(adat.text).toBe('**adat**, gewoonte, gebruik');
    expect(adat.base).toBe('adat');
    expect(adat.homonym).toBe(0);
    expect(adat.words).toContainEqual(
      expect.objectContaining({ word: 'adat', lang: 'id', keyword: 1 })
    );
    expect(adat.words).toContainEqual(
      expect.objectContaining({ word: 'gewoonte', lang: 'nl', keyword: 1 })
    );
    expect(adat.words).toContainEqual(
      expect.objectContaining({ word: 'gebruik', lang: 'nl', keyword: 1 })
    );

    // order values must increase across lemma groups
    const abadOrder = abad1.words.find(
      (w: { keyword: number }) => w.keyword === 1
    )?.order;
    const adatOrder = adat.words.find(
      (w: { keyword: number }) => w.keyword === 1
    )?.order;
    expect(adatOrder).toBeGreaterThan(abadOrder);
  });

  it('assigns homonym index 1 when the same base appears in consecutive groups', async () => {
    // 'II' is filtered (ABBREVIATIONS_NL), so generatie and geslacht are the target keywords.
    const input = [
      '**abad** I, eeuw, tijdperk',
      '',
      '**abad** II, generatie, geslacht',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));

    expect(lemmas).toHaveLength(2);
    expect(lemmas[0].base).toBe('abad');
    expect(lemmas[0].homonym).toBe(0);
    expect(lemmas[1].base).toBe('abad');
    expect(lemmas[1].homonym).toBe(1);
  });

  it('deletes the output file when a parse error occurs', async () => {
    const input = '**unclosed\n';
    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await new Compiler(inFile, outFile).run();
    errorSpy.mockRestore();

    expect(fs.existsSync(outFile)).toBe(false);
  });
});
