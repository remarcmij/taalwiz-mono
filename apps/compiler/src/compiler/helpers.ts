export function removeParenthesizedFragments(line: string) {
  let depth = 0;
  let start = 0;
  let result = '';
  const reParens = new RegExp('[()]', 'g');

  let match = reParens.exec(line);

  while (match) {
    if (match[0] === '(') {
      if (depth++ === 0) {
        result += line.substring(start, match.index);
      }
    } else {
      if (--depth === 0) {
        start = match.index + 1;
      } else if (depth < 0) {
        throw new Error('unbalanced parentheses');
      }
    }
    match = reParens.exec(line);
  }

  if (depth > 0) {
    throw new Error('unbalanced parentheses');
  }

  if (start === 0) {
    return line;
  }

  result += line.substring(start);
  return result;
}
