import { describe, expect, it } from 'vitest';
import { applySm2, selectStudyQueue, StudyCard } from './srs.service.js';

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

describe('selectStudyQueue', () => {
  const NOW = new Date('2026-06-17T12:00:00');
  const yesterday = new Date('2026-06-16T12:00:00');
  const earlierToday = new Date('2026-06-17T08:00:00');
  const due = new Date('2026-06-17T00:00:00');
  const tomorrow = new Date('2026-06-18T12:00:00');

  // Fresh, never-introduced card. `order` higher = earlier in the list.
  const fresh = (order: number): StudyCard => ({ reps: 0, dueDate: due, introducedAt: null, order });

  it('caps fresh new cards at the daily limit', () => {
    const cards = Array.from({ length: 50 }, (_, i) => fresh(50 - i));
    expect(selectStudyQueue(cards, 20, NOW)).toHaveLength(20);
  });

  it('serves fresh new cards in list order (highest order first)', () => {
    const cards = [fresh(1), fresh(3), fresh(2)];
    expect(selectStudyQueue(cards, 20, NOW).map((c) => c.order)).toEqual([3, 2, 1]);
  });

  it('spends the budget on cards introduced today, surviving cancel/restart', () => {
    // 8 introduced earlier today (graduated: reps 1, due tomorrow) + 42 fresh.
    const introduced = Array.from({ length: 8 }, () => ({
      reps: 1,
      dueDate: tomorrow,
      introducedAt: earlierToday,
      order: 0,
    }));
    const freshCards = Array.from({ length: 42 }, (_, i) => fresh(42 - i));
    const queue = selectStudyQueue([...introduced, ...freshCards], 20, NOW);
    // Graduated cards aren't due, so the queue is only the remaining 12 fresh new.
    expect(queue).toHaveLength(12);
    expect(queue.every((c) => c.introducedAt === null)).toBe(true);
  });

  it('does not re-charge budget for a card failed (Again) earlier today', () => {
    // 20 introduced today, all failed back to reps 0 and due now.
    const failedToday: StudyCard[] = Array.from({ length: 20 }, () => ({
      reps: 0,
      dueDate: due,
      introducedAt: earlierToday,
      order: 0,
    }));
    const queue = selectStudyQueue([...failedToday, fresh(1)], 20, NOW);
    // Budget is spent (20 introduced today), so the fresh card waits; the 20
    // in-progress cards are all re-served.
    expect(queue).toHaveLength(20);
    expect(queue.every((c) => c.introducedAt !== null)).toBe(true);
  });

  it('frees budget the next day for a card introduced yesterday', () => {
    const lapsedYesterday: StudyCard = { reps: 0, dueDate: due, introducedAt: yesterday, order: 0 };
    const queue = selectStudyQueue([lapsedYesterday, fresh(1)], 1, NOW);
    // The lapsed card is served (due, already introduced) AND one fresh card fits
    // today's budget of 1, because yesterday's introduction doesn't count today.
    expect(queue).toHaveLength(2);
  });

  it('serves due reviews before new cards and never caps reviews', () => {
    const reviews: StudyCard[] = Array.from({ length: 30 }, () => ({
      reps: 3,
      dueDate: due,
      introducedAt: yesterday,
      order: 0,
    }));
    const queue = selectStudyQueue([...reviews, fresh(1)], 20, NOW);
    expect(queue).toHaveLength(31); // 30 reviews (uncapped) + 1 fresh
    expect(queue.slice(0, 30).every((c) => c.reps > 0)).toBe(true);
    expect(queue[30]?.introducedAt).toBeNull();
  });

  it('excludes reviews not yet due', () => {
    const future: StudyCard = { reps: 3, dueDate: tomorrow, introducedAt: yesterday, order: 0 };
    expect(selectStudyQueue([future], 20, NOW)).toHaveLength(0);
  });
});
