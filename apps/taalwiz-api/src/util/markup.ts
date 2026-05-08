import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import { markedSmartypants } from 'marked-smartypants';

marked.use(markedSmartypants(), gfmHeadingId());

const FOREIGN_FRAGMENT_RE = /\*{1,2}.+?\*{1,2}/g;
const FOREIGN_WORD_RE = /([-'()\p{L}]{2,})|(<.+?>)/gu;

export async function convertMarkdown(text: string): Promise<string> {
  const markdownString = markupFragments(text);

  const html = await marked.parse(markdownString, {
    breaks: true,
  });

  return html.replace(/<table>/gm, "<table class='table'>");
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
