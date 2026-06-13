import { NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SrsService } from '../srs/srs.service.js';
import VocabularyItem from './models/vocabulary-item.model.js';
import VocabularyList from './models/vocabulary-list.model.js';
import { VocabularyService } from './vocabulary.service.js';

vi.mock('./models/vocabulary-list.model.js', () => ({
  default: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn(), create: vi.fn() },
}));
vi.mock('./models/vocabulary-item.model.js', () => ({
  default: { find: vi.fn(), aggregate: vi.fn(), bulkWrite: vi.fn() },
}));
vi.mock('../users/models/user.model.js', () => ({ default: { find: vi.fn() } }));

const oid = (hex: string) => new Types.ObjectId(hex.padStart(24, '0'));
const USER = oid('1').toString();
const LIST = oid('2').toString();

const execResolving = (value: unknown) => ({ exec: vi.fn().mockResolvedValue(value) });
const findChainResolving = (value: unknown) => ({
  select: () => ({ sort: () => ({ lean: () => execResolving(value) }) }),
});

describe('VocabularyService', () => {
  let service: VocabularyService;
  let srs: { createCards: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    srs = { createCards: vi.fn().mockResolvedValue(undefined) };
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

  describe('cloneList', () => {
    it('throws NotFoundException when the source is not a public list', async () => {
      vi.mocked(VocabularyList.findOne).mockReturnValue(execResolving(null) as never);
      await expect(service.cloneList(USER, LIST)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('auto-suffixes the name on collision with an existing list', async () => {
      const source = { _id: oid('2'), name: 'Greetings', isPublic: true };
      vi.mocked(VocabularyList.findOne).mockReturnValue(execResolving(source) as never);
      vi.mocked(VocabularyList.create)
        .mockRejectedValueOnce({ code: 11000 })
        .mockResolvedValueOnce({ _id: oid('9'), name: 'Greetings (copy)' } as never);
      vi.mocked(VocabularyItem.find).mockReturnValue(findChainResolving([]) as never);

      const result = await service.cloneList(USER, LIST);

      expect(vi.mocked(VocabularyList.create)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(VocabularyList.create).mock.calls[1][0]).toMatchObject({
        name: 'Greetings (copy)',
      });
      expect(result).toMatchObject({ name: 'Greetings (copy)', isPublic: false, count: 0 });
    });

    it('copies items into the new list and creates SRS cards for them', async () => {
      const source = { _id: oid('2'), name: 'Animals', isPublic: true };
      const newId = oid('9');
      vi.mocked(VocabularyList.findOne).mockReturnValue(execResolving(source) as never);
      vi.mocked(VocabularyList.create).mockResolvedValue({ _id: newId, name: 'Animals' } as never);
      vi.mocked(VocabularyItem.find).mockReturnValue(
        findChainResolving([{ term: 'anjing', lang: 'id', back: 'dog' }]) as never,
      );
      vi.mocked(VocabularyItem.bulkWrite).mockResolvedValue({} as never);

      const result = await service.cloneList(USER, LIST);

      expect(VocabularyItem.bulkWrite).toHaveBeenCalled();
      expect(srs.createCards).toHaveBeenCalledWith(
        USER,
        expect.arrayContaining([
          expect.objectContaining({ term: 'anjing', lang: 'id', listId: newId.toString() }),
        ]),
      );
      expect(result).toMatchObject({ id: newId.toString(), name: 'Animals', count: 1 });
    });
  });
});
