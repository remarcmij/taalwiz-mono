import ArticleLoader from './ArticleLoader.js';

// parseContent is protected; cast to reach it. The throwing paths short-circuit
// before any DB access, and the main-manifest path performs no DB work either.
const parse = (content: string, filename: string) =>
  (new ArticleLoader() as any).parseContent(content, filename) as Promise<unknown>;

const frontMatter = (lines: string[]) => `---\n${lines.join('\n')}\n---\n\n# Body\n`;

describe('ArticleLoader targetLang validation', () => {
  it('rejects an article whose targetLang does not match the deployment', async () => {
    const content = frontMatter(['title: Greetings', 'targetLang: nl']);
    await expect(parse(content, 'indonesian.greetings.md')).rejects.toThrow(
      /does not match the deployment target language/,
    );
  });

  it('rejects an article that is missing targetLang', async () => {
    const content = frontMatter(['title: Greetings']);
    await expect(parse(content, 'indonesian.greetings.md')).rejects.toThrow(
      /missing required "targetLang"/,
    );
  });

  it('rejects a group manifest whose targetLang does not match', async () => {
    const content = frontMatter(['title: Indonesian', 'targetLang: nl', 'articles:', '  - intro']);
    await expect(parse(content, 'indonesian.manifest.md')).rejects.toThrow(
      /does not match the deployment target language/,
    );
  });

  it('accepts the main manifest without a targetLang (exempt)', async () => {
    // The main manifest is a language-agnostic index; it performs no DB work in
    // parseManifest, so this resolves without a DB connection.
    const content = frontMatter(['groups:', '  - indonesian']);
    await expect(parse(content, 'main.manifest.md')).resolves.toBeDefined();
  });
});
