/**
 * Parses a single bulk-import line into its `term` and optional `back` side.
 *
 * The format is `term;back`, one item per line, with the semicolon as the
 * delimiter. To stay compatible with Anki's text import (and to let a term or
 * flip side contain a literal `;`), a field may be wrapped in double quotes;
 * inside a quoted field a doubled `""` is a literal quote and the delimiter is
 * taken literally. Lines with no quotes are split exactly as before, so existing
 * imports are unaffected.
 *
 * Only the first delimiter is significant: anything after it becomes the `back`,
 * so an unquoted `a;b;c` still yields term `a`, back `b;c`.
 */
export function splitImportLine(line: string): { term: string; back?: string } {
  const fields = parseDelimited(line);
  return {
    term: (fields[0] ?? '').trim(),
    back: fields.slice(1).join(';').trim() || undefined,
  };
}

function parseDelimited(line: string): string[] {
  // Fast path: no quoting in play, behave identically to `line.split(';')`.
  if (!line.includes('"')) return line.split(';');

  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  let atFieldStart = true;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"'; // escaped quote
          i++;
        } else {
          inQuotes = false; // closing quote
        }
      } else {
        field += ch;
      }
    } else if (ch === ';') {
      fields.push(field);
      field = '';
      atFieldStart = true;
    } else if (ch === '"' && atFieldStart) {
      inQuotes = true; // a quote only opens a field at its start (RFC-4180 style)
      atFieldStart = false;
    } else {
      field += ch; // a stray quote mid-field is taken literally
      atFieldStart = false;
    }
  }
  fields.push(field);

  return fields;
}
