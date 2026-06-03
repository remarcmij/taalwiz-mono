import ArticleLoader, { applyHashtagSpans, renderArticleHtml } from './ArticleLoader.js';

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

describe('applyHashtagSpans', () => {
  const file = 'indonesian.greetings.md';

  it('wraps an inline hashtag in body text', () => {
    const html = applyHashtagSpans('The word #selamat means "greetings".', file);
    expect(html).toMatch(/<span id="_[a-f0-9]{24}_" class="hashtag">#selamat<\/span>/);
  });

  it('wraps a hashtag inside a heading while keeping the heading marker', () => {
    const html = applyHashtagSpans('## Greetings #selamat', file);
    expect(html).toMatch(/^## Greetings <span id="_[a-f0-9]{24}_" class="hashtag">#selamat<\/span>$/);
  });

  it('wraps a braced multi-word hashtag inside a heading', () => {
    const html = applyHashtagSpans('# Topic #{selamat pagi}', file);
    expect(html).toContain('class="hashtag">#selamat pagi</span>');
    expect(html.startsWith('# Topic ')).toBe(true);
  });

  it('does not treat the bare heading marker as a hashtag', () => {
    const html = applyHashtagSpans('# Greetings', file);
    expect(html).toBe('# Greetings');
  });

  it('leaves an escaped hashtag untouched', () => {
    const html = applyHashtagSpans('Escaped \\#selamat stays literal', file);
    expect(html).toBe('Escaped \\#selamat stays literal');
  });

  it('numbers occurrences continuously across a heading and the body below it', () => {
    const html = applyHashtagSpans('## About #food\n\nMore about #food here.', file);
    const ids = [...html.matchAll(/id="_([a-f0-9]{24})_"/g)].map((m) => m[1]);
    // Same tag, two occurrences -> two distinct, occurrence-numbered ids.
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('keeps the hashtag span inside the rendered heading element', async () => {
    const html = await renderArticleHtml('## Greetings #selamat', file);
    // The span must survive marked + sanitize-html and stay within the <h2>.
    expect(html).toMatch(/<h2[^>]*>.*class="hashtag">#selamat<\/span>.*<\/h2>/s);
  });
});
