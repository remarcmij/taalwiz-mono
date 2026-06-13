import { describe, expect, it } from 'vitest';
import { splitImportLine } from './import-line-parser';

describe('splitImportLine', () => {
  it('splits a simple term;back line', () => {
    expect(splitImportLine('kucing hitam;black cat')).toEqual({
      term: 'kucing hitam',
      back: 'black cat',
    });
  });

  it('treats a line with no delimiter as a term-only entry', () => {
    expect(splitImportLine('anjing')).toEqual({ term: 'anjing', back: undefined });
  });

  it('trims surrounding whitespace on both fields', () => {
    expect(splitImportLine('  anjing ;  dog ')).toEqual({ term: 'anjing', back: 'dog' });
  });

  it('keeps everything after the first delimiter as the back (legacy behaviour)', () => {
    expect(splitImportLine('apple;pomme;manzana')).toEqual({
      term: 'apple',
      back: 'pomme;manzana',
    });
  });

  it('treats an empty back as undefined', () => {
    expect(splitImportLine('anjing;')).toEqual({ term: 'anjing', back: undefined });
  });

  it('allows a semicolon inside a quoted term', () => {
    expect(splitImportLine('"a;b";c')).toEqual({ term: 'a;b', back: 'c' });
  });

  it('allows a semicolon inside a quoted back', () => {
    expect(splitImportLine('makan;"eat; to consume"')).toEqual({
      term: 'makan',
      back: 'eat; to consume',
    });
  });

  it('unescapes a doubled quote inside a quoted field', () => {
    expect(splitImportLine('say "hi";"she said ""hi""')).toEqual({
      term: 'say "hi"',
      back: 'she said "hi"',
    });
  });

  it('is unaffected by quotes when none are present (fast path)', () => {
    expect(splitImportLine('a;b')).toEqual({ term: 'a', back: 'b' });
  });
});
