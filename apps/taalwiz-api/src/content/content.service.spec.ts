import { Test, TestingModule } from '@nestjs/testing';
import { ContentService } from './content.service.js';
import Topic from './models/topic.model.js';

vi.mock('./models/topic.model.js', () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

describe('ContentService', () => {
  let service: ContentService;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContentService],
    }).compile();

    service = module.get<ContentService>(ContentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deleteTopic', () => {
    it('returns deletedCount 0 when the topic does not exist', async () => {
      vi.mocked(Topic.findOne).mockReturnValue({ exec: vi.fn().mockResolvedValue(null) } as any);

      const result = await service.deleteTopic('nonexistent.json');

      expect(result).toEqual({ deletedCount: 0 });
    });

    it('cascades to dictLoader.removeTopic for a dict topic', async () => {
      const mockTopic = { _id: 'abc', type: 'dict', filename: 'vandale.a.json' };
      vi.mocked(Topic.findOne).mockReturnValue({ exec: vi.fn().mockResolvedValue(mockTopic) } as any);
      const removeSpy = vi.spyOn(service['dictLoader'], 'removeTopic').mockResolvedValue(undefined);

      const result = await service.deleteTopic('vandale.a.json');

      expect(removeSpy).toHaveBeenCalledWith(mockTopic);
      expect(result).toEqual({ deletedCount: 1 });
    });

    it('cascades to articleLoader.removeTopic for an article topic', async () => {
      const mockTopic = { _id: 'def', type: 'article', filename: 'book.intro.md' };
      vi.mocked(Topic.findOne).mockReturnValue({ exec: vi.fn().mockResolvedValue(mockTopic) } as any);
      const removeSpy = vi
        .spyOn(service['articleLoader'], 'removeTopic')
        .mockResolvedValue(undefined);

      const result = await service.deleteTopic('book.intro.md');

      expect(removeSpy).toHaveBeenCalledWith(mockTopic);
      expect(result).toEqual({ deletedCount: 1 });
    });
  });
});
