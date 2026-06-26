import type { Parser } from './ParserBase.js';
import StevensParser from './StevensParser.js';
import TeeuwParser from './TeeuwParser.js';

export type ParserFactory = () => Parser;

interface ParserRegistryEntry {
  prefix: string;
  factory: ParserFactory;
  // When true, the compiler warns if a chapter's headwords are not in
  // alphabetical order — a source-validation aid. Off for Teeuw, whose editorial
  // ordering quirks (e.g. double-filed words) are accepted, not bugs.
  checkHeadwordOrder?: boolean;
}

export const parserRegistry: ParserRegistryEntry[] = [
  { prefix: 'teeuw', factory: () => new TeeuwParser() },
  { prefix: 'stevens', factory: () => new StevensParser(), checkHeadwordOrder: true },
];
