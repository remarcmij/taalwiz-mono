// Removes balanced `(...)` fragments (the second pass of the parenthesis
// double-pass; see TEEUW_PARSER.md §1.3). Tolerant of UNMATCHED parentheses: a
// stray `)` is kept as a literal and a never-closed `(` drops the rest of the
// line. This matters for Stevens, whose enumerated senses use `a)` `b)` `c)`
// markers (a `)` with no opener) on tens of thousands of lines. For balanced
// input (e.g. all of Teeuw) the output is identical to a strict pass.
export function removeParenthesizedFragments(line: string) {
  let depth = 0;
  let result = '';

  for (const ch of line) {
    if (ch === '(') {
      depth++;
    } else if (ch === ')') {
      if (depth > 0) {
        depth--;
      } else {
        // Unmatched close: a literal `)` (e.g. an `a)` sense enumerator).
        result += ch;
      }
    } else if (depth === 0) {
      result += ch;
    }
  }

  return result;
}
