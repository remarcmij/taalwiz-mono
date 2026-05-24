import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { FilterQuery } from 'mongoose';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import type { TopicDoc } from './models/topic.model.js';
import EventEmitter from 'node:events';
import { LRUCache } from 'lru-cache';
import ArticleLoader, { renderArticleHtml } from './loaders/ArticleLoader.js';
import { Loader } from './loaders/BaseLoader.js';
import DictLoader from './loaders/DictLoader.js';
import Article from './models/article.model.js';
import Topic from './models/topic.model.js';

@Injectable()
export class ContentService {
  public readonly uploadEventEmitter = new EventEmitter();
  private readonly articleLoader = new ArticleLoader();
  private readonly dictLoader = new DictLoader();
  private uploadChain: Promise<void> = Promise.resolve();
  private readonly logger = new Logger(ContentService.name);
  readonly #htmlCache = new LRUCache<string, string>({ max: 500 });

  private authorizedGroups(user: JwtPayload): string[] | null {
    if (user.roles?.includes('admin')) return null;
    return [...(user.groups ?? []), 'public'];
  }

  async findPublications(user: JwtPayload) {
    const mainManifest = await Topic.findOne({ type: 'main' }).lean();
    if (!mainManifest?.groups?.length) {
      return [];
    }
    const groups = this.authorizedGroups(user);
    const authorizedGroupList = groups
      ? mainManifest.groups.filter((g) => groups.includes(g))
      : mainManifest.groups;

    const manifests = await Topic.find({
      type: 'manifest',
      groupName: { $in: authorizedGroupList },
    }).lean();

    return authorizedGroupList
      .map((g) => manifests.find((m) => m.groupName === g))
      .filter((m): m is NonNullable<typeof m> => m != null);
  }

  async findPublicationTopics(groupName: string, user: JwtPayload) {
    const groups = this.authorizedGroups(user);
    if (groups && !groups.includes(groupName)) {
      throw new ForbiddenException();
    }

    const manifestTopic = await Topic.findOne({ type: 'manifest', groupName }).lean();
    const articles = await Topic.find({ type: 'article', groupName }).lean();

    if (!manifestTopic) {
      return articles;
    }

    const ordered = (manifestTopic.articles ?? [])
      .map((name) => articles.find((a) => a.filename === `${groupName}.${name}.md`))
      .filter((a): a is NonNullable<typeof a> => a != null);

    return [manifestTopic, ...ordered];
  }

  async findArticle(filename: string) {
    const article = await Article.findOne({ filename }).select('-indexText').lean();
    if (!article) return null;
    const htmlText = await this.#getHtml(article.filename, article.mdText);
    const { mdText: _mdText, ...rest } = article;
    return { ...rest, htmlText };
  }

  async #getHtml(filename: string, mdText: string): Promise<string> {
    const cached = this.#htmlCache.get(filename);
    if (cached !== undefined) return cached;
    const html = await renderArticleHtml(mdText, filename);
    this.#htmlCache.set(filename, html);
    return html;
  }

  async findContentManifest(user: JwtPayload) {
    const query: FilterQuery<TopicDoc> = { type: { $in: ['article', 'manifest', 'main'] } };
    const groups = this.authorizedGroups(user);
    if (groups) query.groupName = { $in: groups };
    return await Topic.find(query).select('filename sha -_id').lean();
  }

  async findGroups(): Promise<string[]> {
    return await Topic.distinct('groupName').exec();
  }

  uploadContent(file: Express.Multer.File, res: Response): void {
    if (!file) {
      return void res.status(400).json({ message: 'No file provided' });
    }

    let loader: Loader;

    if (/\.json$/.test(file.originalname)) {
      loader = this.dictLoader;
    } else if (/\.md$/.test(file.originalname)) {
      loader = this.articleLoader;
    } else {
      return void res.status(400).json({ message: 'Invalid upload file type' });
    }

    const data = file.buffer.toString('utf8');

    this.uploadEventEmitter.emit('upload', file.originalname);
    this.#htmlCache.clear();

    this.uploadChain = this.uploadChain.then(async () => {
      try {
        await loader.importUpload(data, file.originalname);
        this.logger.log(`file '${file.originalname}' uploaded successfully`);
        res.json({ filename: file.originalname });
      } catch (err) {
        let message = 'unknown error';
        if (err instanceof Error) {
          if (err.name === 'ValidationError') {
            message = err.toString();
          } else {
            message = err.message;
          }
        }
        this.logger.error(`error uploading file '${file.originalname}': ${message}`);
        res.status(400).json({ message: message });
      }
    });
  }

  async deleteTopic(filename: string) {
    const topic = await Topic.findOne({ filename }).exec();
    if (!topic) {
      return { deletedCount: 0 };
    }
    const loader = topic.type === 'dict' ? this.dictLoader : this.articleLoader;
    await loader.removeTopic(topic);
    return { deletedCount: 1 };
  }
}
