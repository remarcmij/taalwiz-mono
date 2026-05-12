export interface IHeading {
  id: string;
  text: string;
  level: number;
}

export function extractHeadings(htmlText: string): IHeading[] {
  const doc = new DOMParser().parseFromString(htmlText, 'text/html');
  return Array.from(doc.querySelectorAll('h1, h2, h3')).map((el) => ({
    id: el.id,
    text: el.textContent ?? '',
    level: parseInt(el.tagName[1], 10),
  }));
}
