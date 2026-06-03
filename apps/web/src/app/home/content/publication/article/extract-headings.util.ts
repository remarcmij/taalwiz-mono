export interface IHeading {
  id: string;
  text: string;
  level: number;
}

export function extractHeadings(htmlText: string): IHeading[] {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  return Array.from(doc.querySelectorAll('h1, h2, h3')).map((el) => {
    // A hashtag inside a heading carries a decorative `#` glyph; drop it so the
    // sidebar TOC reads as plain prose (the tag word itself is kept). This mutates
    // only the detached parsed document, not the live DOM.
    el.querySelectorAll('span.hashtag .hash-sign').forEach((sign) => sign.remove());
    return {
      id: el.id,
      text: el.textContent ?? '',
      level: parseInt(el.tagName[1], 10),
    };
  });
}
