import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Compiler } from '../compiler/Compiler.js';
import { parserRegistry } from '../compiler/parser-registry.js';

// Headword validation is OFF by default (a normal compile stays quiet); the
// order-report scripts flip it on in-process. The two warning tests below do the
// same so they exercise the validation path. Toggle and restore around each so
// the shared registry state never leaks to other tests.
function withStevensValidation(fn: () => Promise<void>): Promise<void> {
  const entry = parserRegistry.find((e) => e.prefix === 'stevens')!;
  const prev = entry.validateHeadwords;
  entry.validateHeadwords = true;
  return fn().finally(() => {
    entry.validateHeadwords = prev;
  });
}

describe('Compiler', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'taalwiz-compiler-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('compiles a two-group Teeuw dict file to correct JSON', async () => {
    // 'I' is filtered (EDITORIAL_MARKERS_NL), so eeuw and tijdperk are the only target words.
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
  });

  it('assigns homonym index 1 when the same base appears in consecutive groups', async () => {
    // 'II' is filtered (EDITORIAL_MARKERS_NL), so generatie and geslacht are the target words.
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

  it('merges a core and supplement file into one JSON, stamping isSupplement on supplements', async () => {
    const core = ['**abad** I, eeuw, tijdperk', '', '**adat**, gewoonte, gebruik'].join('\n');
    const plus = '**akun**, account, gebruikersaccount';

    const coreFile = path.join(tmpDir, 'teeuw.a.md');
    const plusFile = path.join(tmpDir, 'teeuw.a+.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(coreFile, core, 'utf8');
    fs.writeFileSync(plusFile, plus, 'utf8');

    // Core before supplement, as index.ts orders them.
    await new Compiler([coreFile, plusFile], outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));

    expect(lemmas).toHaveLength(3);
    const [abad, adat, akun] = lemmas;

    // Core entries are unchanged and carry no isSupplement marker.
    expect(abad.base).toBe('abad');
    expect(abad.isSupplement).toBeUndefined();
    expect(adat.base).toBe('adat');
    expect(adat.isSupplement).toBeUndefined();

    // The supplement entry is present in the same JSON and flagged.
    expect(akun.base).toBe('akun');
    expect(akun.isSupplement).toBe(true);
    expect(akun.words).toContainEqual(
      expect.objectContaining({ word: 'akun', lang: 'id', keyword: 1 })
    );
    expect(akun.words).toContainEqual(
      expect.objectContaining({ word: 'account', lang: 'nl', keyword: 1 })
    );
  });

  it('continues homonym numbering when a supplement repeats the core boundary headword', async () => {
    const core = '**adat**, gewoonte, gebruik';
    const plus = '**adat** II, nieuwe zede';

    const coreFile = path.join(tmpDir, 'teeuw.a.md');
    const plusFile = path.join(tmpDir, 'teeuw.a+.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(coreFile, core, 'utf8');
    fs.writeFileSync(plusFile, plus, 'utf8');

    await new Compiler([coreFile, plusFile], outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));

    expect(lemmas).toHaveLength(2);
    expect(lemmas[0].base).toBe('adat');
    expect(lemmas[0].homonym).toBe(0);
    expect(lemmas[0].isSupplement).toBeUndefined();
    // The parser is shared across the file boundary, so the repeated headword
    // continues as homonym 1 rather than resetting to 0.
    expect(lemmas[1].base).toBe('adat');
    expect(lemmas[1].homonym).toBe(1);
    expect(lemmas[1].isSupplement).toBe(true);
  });

  it('resolves `^` to the headword, past an intervening bold compound', async () => {
    // Printed Teeuw resumes the headword's compound list by starting a line
    // without a bold word; flattening loses that, so `^` says it explicitly.
    const input = [
      '**anak**, 1 kind',
      '**anak+tiri**, stiefkind',
      '*^ tunggal*, enig kind',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(lemmas).toHaveLength(3);
    expect(lemmas[2].text).toBe('*anak tunggal*, enig kind');
    expect(lemmas[2].base).toBe('anak');
  });

  it('resolves `~` to the nearest bold word, including a compound', async () => {
    // Teeuw's own convention: inside the `terima kasih` sublemma the swung dash
    // is the compound, so `kurang ~` is "kurang terima kasih".
    const input = [
      '**terima**, aanvaarding',
      '**terima+kasih**, dank(betuiging)',
      '*kurang ~*, ondankbaar',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.t.md');
    const outFile = path.join(tmpDir, 'teeuw.t.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(lemmas[2].text).toBe('*kurang terima kasih*, ondankbaar');
  });

  it('does not latch: `^` binds only its own occurrence, `~` still follows the bold word', async () => {
    const input = [
      '**anak**, 1 kind',
      '**anak+tiri**, stiefkind',
      '*^ tunggal*, enig kind',
      '*~ angkat*, aangenomen stiefkind',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(lemmas).toHaveLength(4);
    // `^` resolved to the headword ...
    expect(lemmas[2].text).toBe('*anak tunggal*, enig kind');
    // ... and left `~` on the compound, rather than latching it to the base.
    expect(lemmas[3].text).toBe('*anak tiri angkat*, aangenomen stiefkind');
  });

  it('attributes a bare sense number to the nearest bold word', async () => {
    // A headword sense that follows a bold compound must name the headword
    // explicitly; the bare digit binds to the compound, not the base.
    const input = [
      '**anak**, 1 kind',
      '**anak+tiri**, stiefkind',
      '2 jong dier',
      '**anak**, 3 scheut',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(lemmas[2].text).toBe('**anak tiri**, 2 jong dier');
    expect(lemmas[3].text).toBe('**anak**, 3 scheut');
  });

  it('errors on a `^` marker before any headword', async () => {
    const input = ['^', '*~ tunggal*, enig kind'].join('\n');
    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await new Compiler(inFile, outFile).run();
    errorSpy.mockRestore();

    expect(fs.existsSync(outFile)).toBe(false);
  });

  it('skips `//` comment lines without breaking the surrounding block', async () => {
    const input = [
      '// leading comment, ignored',
      '**abad** I, eeuw',
      '// a comment mid-entry must NOT split the block',
      '2 tijd',
      '',
      '// another comment',
      '**adat**, gewoonte',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));

    // Comments contribute no lemmas; the mid-entry comment kept abad's two lines
    // in one block, so the bare "2" line still re-anchored to **abad**.
    expect(lemmas).toHaveLength(3);
    expect(lemmas[0].base).toBe('abad');
    expect(lemmas[1].text).toBe('**abad**, 2 tijd');
    expect(lemmas[2].base).toBe('adat');
  });

  it('warns (non-fatally) when a Stevens headword is out of alphabetical order', () =>
    withStevensValidation(async () => {
      const input = ['**abad** century.', '', '**zebra** zebra.', '', '**baba** dad.'].join('\n');
      const inFile = path.join(tmpDir, 'stevens.x.md');
      const outFile = path.join(tmpDir, 'stevens.x.json');
      fs.writeFileSync(inFile, input, 'utf8');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await new Compiler(inFile, outFile).run();
      const warned = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
      warnSpy.mockRestore();

      // Build still succeeds, and the warning names the misplaced headword + file.
      expect(fs.existsSync(outFile)).toBe(true);
      expect(warned).toMatch(/out of alphabetical order/);
      expect(warned).toMatch(/"baba"/);
      expect(warned).toMatch(/stevens\.x\.md/);
      // Only the one descent (baba after zebra) is flagged.
      expect(warned.match(/out of alphabetical order/g)).toHaveLength(1);
    }));

  it('warns when a Stevens headword does not start with the chapter letter', () =>
    withStevensValidation(async () => {
      // `**2 to**` (a mangled `__2__ to` sense line) parses to base "to" in the `a`
      // file — a conversion artifact the leading-letter rule catches.
      const input = ['**abad** century.', '', '**to** think carefully about it.'].join('\n');
      const inFile = path.join(tmpDir, 'stevens.a.md');
      const outFile = path.join(tmpDir, 'stevens.a.json');
      fs.writeFileSync(inFile, input, 'utf8');

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await new Compiler(inFile, outFile).run();
      const warned = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
      warnSpy.mockRestore();

      expect(fs.existsSync(outFile)).toBe(true);
      expect(warned).toMatch(/does not start with the chapter letter "a"/);
      expect(warned).toMatch(/"to"/);
    }));

  it('does not warn on alphabetical order when Stevens headwords ascend', async () => {
    const input = ['**abad** century.', '', '**baba** dad.', '', '**zebra** zebra.'].join('\n');
    const inFile = path.join(tmpDir, 'stevens.x.md');
    const outFile = path.join(tmpDir, 'stevens.x.json');
    fs.writeFileSync(inFile, input, 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await new Compiler(inFile, outFile).run();
    const warned = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
    warnSpy.mockRestore();

    expect(warned).not.toMatch(/alphabetical/);
  });

  it('does not validate headwords for Teeuw (opt-in per parser)', async () => {
    // Out of order AND not starting with the chapter letter, but Teeuw's
    // editorial quirks are accepted, so neither rule fires.
    const input = ['**zebra**, zebra', '', '**abad**, eeuw'].join('\n');
    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await new Compiler(inFile, outFile).run();
    const warned = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
    warnSpy.mockRestore();

    expect(warned).not.toMatch(/alphabetical/);
    expect(warned).not.toMatch(/chapter letter/);
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
