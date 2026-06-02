import type { Parser } from './ParserBase.js';
import TeeuwParser from './TeeuwParser.js';

export type ParserFactory = () => Parser;

interface ParserRegistryEntry {
  prefix: string;
  factory: ParserFactory;
}

export const parserRegistry: ParserRegistryEntry[] = [
  { prefix: 'teeuw', factory: () => new TeeuwParser() },
];
