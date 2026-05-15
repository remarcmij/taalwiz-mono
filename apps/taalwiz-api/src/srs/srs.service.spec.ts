import { describe, expect, it } from 'vitest';
import { applySm2 } from './srs.service.js';

const newCard = { interval: 1, easeFactor: 2.5, reps: 0, lapses: 0 };

describe('applySm2', () => {
  describe('again', () => {
    it('resets interval to 1 and increments lapses', () => {
      const result = applySm2({ ...newCard, interval: 10, reps: 3, lapses: 0 }, 'again');
      expect(result.interval).toBe(1);
      expect(result.reps).toBe(0);
      expect(result.lapses).toBe(1);
    });

    it('reduces ease factor by 0.2', () => {
      const result = applySm2({ ...newCard, easeFactor: 2.5 }, 'again');
      expect(result.easeFactor).toBeCloseTo(2.3);
    });

    it('clamps ease factor to 1.3 minimum', () => {
      const result = applySm2({ ...newCard, easeFactor: 1.4 }, 'again');
      expect(result.easeFactor).toBe(1.3);
    });
  });

  describe('good', () => {
    it('sets interval to 1 on first review (reps=0)', () => {
      const result = applySm2(newCard, 'good');
      expect(result.interval).toBe(1);
      expect(result.reps).toBe(1);
    });

    it('sets interval to 6 on second review (reps=1)', () => {
      const result = applySm2({ ...newCard, reps: 1 }, 'good');
      expect(result.interval).toBe(6);
      expect(result.reps).toBe(2);
    });

    it('multiplies interval by ease factor on subsequent reviews', () => {
      const result = applySm2({ ...newCard, interval: 6, reps: 2, easeFactor: 2.5 }, 'good');
      expect(result.interval).toBe(Math.round(6 * 2.5));
    });

    it('does not change ease factor', () => {
      const result = applySm2({ ...newCard, easeFactor: 2.2 }, 'good');
      expect(result.easeFactor).toBe(2.2);
    });
  });

  describe('easy', () => {
    it('sets interval to 4 on first review (reps=0)', () => {
      const result = applySm2(newCard, 'easy');
      expect(result.interval).toBe(4);
      expect(result.reps).toBe(1);
    });

    it('sets interval to 10 on second review (reps=1)', () => {
      const result = applySm2({ ...newCard, reps: 1 }, 'easy');
      expect(result.interval).toBe(10);
    });

    it('multiplies interval by ease factor × 1.3 on subsequent reviews', () => {
      const result = applySm2({ ...newCard, interval: 10, reps: 2, easeFactor: 2.5 }, 'easy');
      expect(result.interval).toBe(Math.round(10 * 2.5 * 1.3));
    });

    it('increases ease factor by 0.15', () => {
      const result = applySm2({ ...newCard, easeFactor: 2.5 }, 'easy');
      expect(result.easeFactor).toBeCloseTo(2.65);
    });

    it('clamps ease factor to 4.0 maximum', () => {
      const result = applySm2({ ...newCard, easeFactor: 3.9 }, 'easy');
      expect(result.easeFactor).toBe(4.0);
    });
  });

  describe('interval clamping', () => {
    it('never exceeds 365 days', () => {
      const result = applySm2({ interval: 300, easeFactor: 2.5, reps: 10, lapses: 0 }, 'good');
      expect(result.interval).toBeLessThanOrEqual(365);
    });
  });
});
