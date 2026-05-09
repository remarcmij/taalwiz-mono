import { vi } from 'vitest';
import { DictionaryController } from './dictionary.controller.js';
import { DictionaryService, FindWordResult } from './dictionary.service.js';

const mockResult: FindWordResult = {
  word: 'test',
  lang: 'id',
  lemmas: [],
  haveMore: false,
};

describe('DictionaryController', () => {
  let controller: DictionaryController;
  const service = {
    findWord: vi.fn().mockResolvedValue(mockResult),
    findAutoCompletions: vi.fn().mockResolvedValue([]),
  } as unknown as DictionaryService;

  beforeEach(() => {
    controller = new DictionaryController(service);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findWord', () => {
    it('should delegate to dictionaryService.findWord', async () => {
      const params = { word: 'membaca', lang: 'id' };
      const query = { keyword: undefined, skip: undefined, limit: undefined };

      const result = await controller.findWord(params as any, query as any);

      expect(service.findWord).toHaveBeenCalledWith(params, query);
      expect(result).toEqual(mockResult);
    });
  });
});
