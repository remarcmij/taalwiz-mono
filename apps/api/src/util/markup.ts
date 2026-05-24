import { marked } from 'marked';
import markedFootnote from 'marked-footnote';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { markedSmartypants } from 'marked-smartypants';
import sanitizeHtml from 'sanitize-html';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'blockquote', 'pre', 'ul', 'ol', 'li', 'hr', 'br',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'a', 'strong', 'em', 'code', 'del', 'span', 'img',
    'sup', 'section',
  ],
  allowedAttributes: {
    'h1': ['id'], 'h2': ['id', 'class'], 'h3': ['id'],
    'h4': ['id'], 'h5': ['id'], 'h6': ['id'],
    'a':       ['href', 'title', 'target', 'id', 'aria-describedby', 'aria-label', 'data-footnote-ref', 'data-footnote-backref'],
    'img':     ['src', 'alt', 'title'],
    'table':   ['class'],
    'span':    ['id', 'class'],
    'sup':     ['id'],
    'li':      ['id'],
    'section': ['class', 'data-footnotes'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
};

marked.use(markedSmartypants(), gfmHeadingId(), markedFootnote());

const FOREIGN_FRAGMENT_RE = /\*{1,2}.+?\*{1,2}/g;
const FOREIGN_WORD_RE = /([-'()\p{L}]{2,})|(<.+?>)/gu;

export async function convertMarkdown(text: string): Promise<string> {
  const markdownString = markupFragments(text);

  const html = await marked.parse(markdownString, {
    breaks: true,
  });

  const htmlWithTableClass = html.replace(/<table>/gm, "<table class='table'>");
  return sanitizeHtml(htmlWithTableClass, SANITIZE_OPTIONS);
}

export function markupFragments(text: string): string {
  let buffer = '';
  let start = 0;
  FOREIGN_FRAGMENT_RE.lastIndex = 0;
  let match = FOREIGN_FRAGMENT_RE.exec(text);
  let fragment: string;

  while (match) {
    fragment = match[0];
    const end = FOREIGN_FRAGMENT_RE.lastIndex - fragment.length;
    buffer = buffer.concat(text.slice(start, end));
    start = FOREIGN_FRAGMENT_RE.lastIndex;
    buffer += markupFragment(fragment);
    match = FOREIGN_FRAGMENT_RE.exec(text);
  }

  buffer += text.slice(start);
  return buffer;
}

function markupFragment(text: string): string {
  let buffer = '';

  let start = 0;
  FOREIGN_WORD_RE.lastIndex = 0;
  let match = FOREIGN_WORD_RE.exec(text);

  while (match) {
    let replacement: string;
    if (match[1]) {
      replacement = `<span>${match[1]}</span>`;
    } else {
      replacement = match[2];
    }
    const end = FOREIGN_WORD_RE.lastIndex - match[0].length;
    buffer += text.slice(start, end);
    start = FOREIGN_WORD_RE.lastIndex;
    buffer += replacement;
    match = FOREIGN_WORD_RE.exec(text);
  }

  buffer += text.slice(start);
  return buffer;
}
