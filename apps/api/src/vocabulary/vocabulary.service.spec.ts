import { ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SrsService } from '../srs/srs.service.js';
import VocabularyItem from './models/vocabulary-item.model.js';
import VocabularyList from './models/vocabulary-list.model.js';
import { VocabularyService } from './vocabulary.service.js';

vi.mock('./models/vocabulary-list.model.js', () => ({
  default: {
    find: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
    create: vi.fn(),
  },
}));
vi.mock('./models/vocabulary-item.model.js', () => ({
  default: { find: vi.fn(), aggregate: vi.fn(), bulkWrite: vi.fn(), deleteOne: vi.fn() },
}));
vi.mock('../users/models/user.model.js', () => ({ default: { find: vi.fn() } }));

const oid = (hex: string) => new Types.ObjectId(hex.padStart(24, '0'));
const USER = oid('1').toString();
const LIST = oid('2').toString();

const execResolving = (value: unknown) => ({ exec: vi.fn().mockResolvedValue(value) });

// The locked-list guard queries `findOne({ isLocked: true })`; every other
// findOne in these flows fetches a list by id. This helper lets a test say
// "nothing is locked" (guard resolves null) while still returning `value` for
// the ordinary lookups.
const findOneUnlocked = (value: unknown) =>
  vi
    .mocked(VocabularyList.findOne)
    .mockImplementation(
      ((query?: { isLocked?: boolean }) =>
        execResolving(query?.isLocked ? null : value)) as never,
    );

describe('VocabularyService', () => {
  let service: VocabularyService;
  let srs: { createCards: ReturnType<typeof vi.fn>; deleteCard: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    srs = {
      createCards: vi.fn().mockResolvedValue(undefined),
      deleteCard: vi.fn().mockResolvedValue(undefined),
    };
    service = new VocabularyService(srs as unknown as SrsService);
  });

  describe('updateList', () => {
    it('does nothing (no DB call) when no fields are provided', async () => {
      await service.updateList(USER, LIST, {});
      expect(VocabularyList.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('sets only the provided fields, scoped to owner', async () => {
      vi.mocked(VocabularyList.findOneAndUpdate).mockReturnValue(execResolving({}) as never);
      await service.updateList(USER, LIST, { isPublic: true });
      const [filter, update] = vi.mocked(VocabularyList.findOneAndUpdate).mock.calls[0];
      expect((filter as { userId: Types.ObjectId }).userId.toString()).toBe(USER);
      expect(update).toEqual({ $set: { isPublic: true } });
    });
  });

  describe('findPublicItems', () => {
    it('throws NotFoundException when the list is missing or not public', async () => {
      vi.mocked(VocabularyList.findOne).mockReturnValue(execResolving(null) as never);
      await expect(service.findPublicItems(LIST)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('importMany', () => {
    it('upserts the items and creates SRS cards', async () => {
      vi.mocked(VocabularyItem.bulkWrite).mockResolvedValue({} as never);

      await service.importMany(USER, [{ term: 'anjing', lang: 'id', listId: LIST, back: 'dog' }]);

      expect(VocabularyItem.bulkWrite).toHaveBeenCalled();
      expect(srs.createCards).toHaveBeenCalledWith(
        USER,
        expect.arrayContaining([
          expect.objectContaining({ term: 'anjing', lang: 'id', listId: LIST }),
        ]),
      );
    });

    it('is allowed even when the target list is locked (never consults the lock guard)', async () => {
      // A deliberate import must go through regardless of the lock, so it must not
      // query the locked-list guard at all — make any findOne blow up to prove it.
      vi.mocked(VocabularyList.findOne).mockImplementation((() => {
        throw new Error('importMany must not consult the lock guard');
      }) as never);
      vi.mocked(VocabularyItem.bulkWrite).mockResolvedValue({} as never);

      await service.importMany(USER, [{ term: 'anjing', lang: 'id', listId: LIST }]);

      expect(VocabularyItem.bulkWrite).toHaveBeenCalled();
    });
  });

  describe('locked-list guard', () => {
    it('addMany rejects with ConflictException when the target list is locked', async () => {
      vi.mocked(VocabularyList.findOne).mockReturnValue(
        execResolving({ _id: oid('2'), name: 'Ham les 1', isLocked: true }) as never,
      );
      await expect(
        service.addMany(USER, [{ term: 'anjing', lang: 'id', listId: LIST }]),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(VocabularyItem.bulkWrite).not.toHaveBeenCalled();
    });

    it('addMany proceeds when no target list is locked', async () => {
      findOneUnlocked(null);
      vi.mocked(VocabularyItem.bulkWrite).mockResolvedValue({} as never);
      await service.addMany(USER, [{ term: 'anjing', lang: 'id', listId: LIST }]);
      expect(VocabularyItem.bulkWrite).toHaveBeenCalled();
    });

    it('remove rejects with ConflictException when the list is locked', async () => {
      vi.mocked(VocabularyList.findOne).mockReturnValue(
        execResolving({ _id: oid('2'), name: 'Ham les 1', isLocked: true }) as never,
      );
      await expect(service.remove(USER, 'anjing', 'id', LIST)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(VocabularyItem.deleteOne).not.toHaveBeenCalled();
    });
  });
});
