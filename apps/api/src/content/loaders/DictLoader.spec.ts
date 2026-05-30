import DictFileLoader from './DictLoader.js';

// parseContent is protected and synchronous; cast to reach it. It performs no
// DB or filesystem work (those happen in createData), so it is safe to call.
const parse = (content: string, filename: string) =>
  (new DictFileLoader() as any).parseContent(content, filename);

const dict = (targetLang: string) => JSON.stringify({ targetLang, lemmas: [] });

describe('DictFileLoader targetLang validation', () => {
  it('rejects a dictionary whose targetLang does not match the deployment', () => {
    expect(() => parse(dict('nl'), 'vandale.a.json')).toThrow(
      /does not match the deployment target language/,
    );
  });

  it('accepts a dictionary whose targetLang matches the deployment', () => {
    expect(() => parse(dict('id'), 'kbbi.a.json')).not.toThrow();
  });
});
