import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { ContentService } from './content.service.js';
import Article from './models/article.model.js';
import Topic from './models/topic.model.js';

vi.mock('./models/topic.model.js', () => ({
  default: {
    findOne: vi.fn(),
    find: vi.fn(),
  },
}));

vi.mock('./models/article.model.js', () => ({
  default: {
    findOne: vi.fn(),
  },
}));

vi.mock('./loaders/ArticleLoader.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./loaders/ArticleLoader.js')>()),
  renderArticleHtml: vi.fn().mockResolvedValue('<p>html</p>'),
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

  describe('findArticle', () => {
    const demoUser: JwtPayload = {
      sub: '1',
      email: 'demo@test.com',
      roles: ['demo'],
      groups: ['claude'],
    };
    const adminUser: JwtPayload = {
      sub: '2',
      email: 'admin@test.com',
      roles: ['admin'],
      groups: [],
    };

    function mockArticle(article: unknown) {
      vi.mocked(Article.findOne).mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(article),
        }),
      } as any);
    }

    it('returns the article when the user is authorized for its group', async () => {
      mockArticle({ filename: 'claude.achtervoegsel-nya.md', groupName: 'claude', mdText: '# Hi' });

      const result = await service.findArticle('claude.achtervoegsel-nya', demoUser);

      expect(result).toMatchObject({ filename: 'claude.achtervoegsel-nya.md', htmlText: '<p>html</p>' });
    });

    it('throws ForbiddenException when the user is not authorized for the group', async () => {
      mockArticle({ filename: 'salindo.basisgrammatica-1.md', groupName: 'salindo', mdText: '# Hi' });

      await expect(service.findArticle('salindo.basisgrammatica-1', demoUser)).rejects.toBeInstanceOf(
        ForbiddenException
      );
    });

    it('allows an admin to fetch an article from any group', async () => {
      mockArticle({ filename: 'salindo.basisgrammatica-1.md', groupName: 'salindo', mdText: '# Hi' });

      const result = await service.findArticle('salindo.basisgrammatica-1', adminUser);

      expect(result).toMatchObject({ filename: 'salindo.basisgrammatica-1.md' });
    });

    it('returns null when the article does not exist', async () => {
      mockArticle(null);

      const result = await service.findArticle('claude.nonexistent', demoUser);

      expect(result).toBeNull();
    });
  });

  describe('deleteTopic', () => {
    it('returns deletedCount 0 when the topic does not exist', async () => {
      vi.mocked(Topic.findOne).mockReturnValue({ exec: vi.fn().mockResolvedValue(null) } as any);

      const result = await service.deleteTopic('nonexistent.json');

      expect(result).toEqual({ deletedCount: 0 });
    });

    it('cascades to dictLoader.removeTopic for a dict topic', async () => {
      const mockTopic = { _id: 'abc', type: 'dict', filename: 'teeuw.a.json' };
      vi.mocked(Topic.findOne).mockReturnValue({ exec: vi.fn().mockResolvedValue(mockTopic) } as any);
      const removeSpy = vi.spyOn(service['dictLoader'], 'removeTopic').mockResolvedValue(undefined);

      const result = await service.deleteTopic('teeuw.a.json');

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
