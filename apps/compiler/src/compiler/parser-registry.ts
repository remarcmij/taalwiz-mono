import type { Parser } from './ParserBase.js';
import StevensParser from './StevensParser.js';
import TeeuwParser from './TeeuwParser.js';

export type ParserFactory = () => Parser;

interface ParserRegistryEntry {
  prefix: string;
  factory: ParserFactory;
  // When true, the compiler warns if a chapter's headwords are out of
  // alphabetical order or don't start with the chapter's letter. This is a QA
  // aid, not part of a normal compile, so it is OFF here for BOTH dicts — a bare
  // compile stays quiet. The order-report / teeuw-order-report scripts flip it
  // on in-process when they regenerate their warning reports. (The remaining
  // warnings are accepted quirks: Teeuw's editorial double-filing, Stevens' PDF
  // conversion artifacts — correctly keyed, invisible to users.)
  validateHeadwords?: boolean;
}

export const parserRegistry: ParserRegistryEntry[] = [
  { prefix: 'teeuw', factory: () => new TeeuwParser() },
  { prefix: 'stevens', factory: () => new StevensParser() },
];
