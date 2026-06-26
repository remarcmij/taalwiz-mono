import type { Parser } from './ParserBase.js';
import StevensParser from './StevensParser.js';
import TeeuwParser from './TeeuwParser.js';

export type ParserFactory = () => Parser;

interface ParserRegistryEntry {
  prefix: string;
  factory: ParserFactory;
  // When true, the compiler warns if a chapter's headwords are out of
  // alphabetical order or don't start with the chapter's letter — source
  // validation aids. Off for Teeuw, whose editorial quirks (e.g. double-filed
  // words) are accepted, not bugs.
  validateHeadwords?: boolean;
}

export const parserRegistry: ParserRegistryEntry[] = [
  { prefix: 'teeuw', factory: () => new TeeuwParser() },
  { prefix: 'stevens', factory: () => new StevensParser(), validateHeadwords: true },
];
