import { tinyMarkdown, convertMarkdown } from '../markdown.ts';

describe('tinyMarkdown', () => {
  it('converts **bold** to <strong>', () => {
    expect(tinyMarkdown('a **bold** word')).toContain('<strong>');
    expect(tinyMarkdown('a **bold** word')).toContain('bold');
  });

  it('converts *italic* to <em>', () => {
    expect(tinyMarkdown('an *italic* word')).toContain('<em>');
    expect(tinyMarkdown('an *italic* word')).toContain('italic');
  });

  it('converts __bold__ to <strong>', () => {
    expect(tinyMarkdown('a __bold__ word')).toContain('<strong>');
  });

  it('converts _italic_ to <em>', () => {
    expect(tinyMarkdown('an _italic_ word')).toContain('<em>');
  });

  it('converts newlines to <br>', () => {
    expect(tinyMarkdown('line1\nline2')).toBe('line1<br>line2');
  });

  it('returns plain text unchanged', () => {
    expect(tinyMarkdown('hello world')).toBe('hello world');
  });
});

describe('convertMarkdown', () => {
  it('wraps foreign fragment words in spans', () => {
    const result = convertMarkdown('Het **rumah** is groot');
    expect(result).toContain('<span>rumah</span>');
  });

  it('leaves plain text unchanged (no bold/italic)', () => {
    const result = convertMarkdown('hello world');
    expect(result).toBe('hello world');
  });
});
