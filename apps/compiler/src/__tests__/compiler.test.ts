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

  it('reverts the tilde to the base after a `^` marker (both `~` and sense lines)', async () => {
    // Without `^`, the bold compound **anak+tiri** captures the tilde, so
    // `~ tunggal` would wrongly become "anak tiri tunggal" and the bare "2"
    // sense would attach to "anak tiri". The `^` marker resets to the base.
    const input = [
      '**anak**, 1 kind',
      '**anak+tiri**, stiefkind',
      '^',
      '*~ tunggal*, enig kind',
      '2 jong dier',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));

    // The `^` line itself emits no lemma.
    expect(lemmas).toHaveLength(4);
    const [, , tunggal, sense2] = lemmas;

    // `~` resolved to the base "anak", not the compound "anak tiri".
    expect(tunggal.text).toBe('*anak tunggal*, enig kind');
    // Bare sense number re-anchored to the base, not the compound.
    expect(sense2.text).toBe('**anak**, 2 jong dier');
    expect(sense2.base).toBe('anak');
  });

  it('accepts the `^` marker as a sublemma prefix (not stored in the text)', async () => {
    const input = [
      '**anak**, 1 kind',
      '**anak+tiri**, stiefkind',
      '^*~ tunggal*, enig kind',
      '*~ yatim*, wees',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));

    expect(lemmas).toHaveLength(4);
    const [, , tunggal, yatim] = lemmas;
    // Prefix reverts to base, and the `^` is stripped from the stored text.
    expect(tunggal.text).toBe('*anak tunggal*, enig kind');
    // The revert latches: the following line stays on the base too.
    expect(yatim.text).toBe('*anak yatim*, wees');
  });

  it('accepts a space after a `^` sublemma prefix (`^ *~ x*`) for readability', async () => {
    const input = [
      '**anak**, 1 kind',
      '**anak+tiri**, stiefkind',
      '^ *~ tunggal*, enig kind',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.a.md');
    const outFile = path.join(tmpDir, 'teeuw.a.json');
    fs.writeFileSync(inFile, input, 'utf8');

    await new Compiler(inFile, outFile).run();

    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(lemmas).toHaveLength(3);
    expect(lemmas[2].text).toBe('*anak tunggal*, enig kind');
  });

  it('warns (non-fatally) when a `~` binds to a compound after its derivation, with no `^`', async () => {
    // **rumah+sakit** sets the tilde; *merumahsakitkan* is its derivation, so the
    // following `~ sewa` should have been reverted to the base with a `^`.
    const input = [
      '**rumah**, huis',
      '**rumah+sakit**, ziekenhuis; *merumahsakitkan*, opnemen',
      '*~ sewa*, huurhuis',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.r.md');
    const outFile = path.join(tmpDir, 'teeuw.r.json');
    fs.writeFileSync(inFile, input, 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await new Compiler(inFile, outFile).run();
    const warned = warnSpy.mock.calls.map((c) => String(c[0])).join('\n');
    warnSpy.mockRestore();

    // Build still succeeds (non-fatal) and the warning names the fix.
    expect(fs.existsSync(outFile)).toBe(true);
    expect(warned).toMatch(/"\^"/);
    expect(warned).toMatch(/rumah sakit/);
  });

  it('does not warn when the `^` revert is present', async () => {
    const input = [
      '**rumah**, huis',
      '**rumah+sakit**, ziekenhuis; *merumahsakitkan*, opnemen',
      '^',
      '*~ sewa*, huurhuis',
    ].join('\n');

    const inFile = path.join(tmpDir, 'teeuw.r.md');
    const outFile = path.join(tmpDir, 'teeuw.r.json');
    fs.writeFileSync(inFile, input, 'utf8');

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await new Compiler(inFile, outFile).run();
    const callCount = warnSpy.mock.calls.length;
    warnSpy.mockRestore();

    expect(callCount).toBe(0);
    // And `~ sewa` resolved to the base.
    const { lemmas } = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    expect(lemmas.at(-1).text).toBe('*rumah sewa*, huurhuis');
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
