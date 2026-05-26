import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { FilterQuery } from 'mongoose';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import type { TopicDoc } from './models/topic.model.js';
import EventEmitter from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LRUCache } from 'lru-cache';
import ArticleLoader, { renderArticleHtml } from './loaders/ArticleLoader.js';
import { Loader } from './loaders/BaseLoader.js';
import DictLoader from './loaders/DictLoader.js';
import Article from './models/article.model.js';
import Topic from './models/topic.model.js';

const IMAGE_EXT_PATTERN = /\.(jpe?g|png|gif|webp)$/i;
const IMAGES_DIR = path.join(import.meta.dirname, '..', '..', 'public/assets/images');

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
    const normalizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    const article = await Article.findOne({ filename: normalizedFilename }).select('-indexText').lean();
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

  async uploadContent(file: Express.Multer.File): Promise<{ filename: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (IMAGE_EXT_PATTERN.test(file.originalname)) {
      return this.#uploadImage(file);
    }

    let loader: Loader;
    if (/\.json$/.test(file.originalname)) {
      loader = this.dictLoader;
    } else if (/\.md$/.test(file.originalname)) {
      loader = this.articleLoader;
    } else {
      throw new BadRequestException('Invalid upload file type');
    }

    const data = file.buffer.toString('utf8');
    this.uploadEventEmitter.emit('upload', file.originalname);
    this.#htmlCache.clear();

    const work = this.uploadChain.then(async () => {
      try {
        await loader.importUpload(data, file.originalname);
        this.logger.log(`file '${file.originalname}' uploaded successfully`);
        return { filename: file.originalname };
      } catch (err) {
        const message = err instanceof Error
          ? err.name === 'ValidationError' ? err.toString() : err.message
          : 'unknown error';
        this.logger.error(`error uploading file '${file.originalname}': ${message}`);
        throw new BadRequestException(message);
      }
    });

    // Keep the chain resolved so a failed upload doesn't block subsequent ones.
    this.uploadChain = work.then(() => undefined, () => undefined);
    return work;
  }

  #uploadImage(file: Express.Multer.File): Promise<{ filename: string }> {
    const { originalname } = file;
    if (originalname.includes('/') || originalname.includes('\\') || originalname.includes('..')) {
      throw new BadRequestException('Invalid image filename');
    }

    this.uploadEventEmitter.emit('upload', originalname);

    const work = this.uploadChain.then(async () => {
      try {
        await fs.mkdir(IMAGES_DIR, { recursive: true });
        await fs.writeFile(path.join(IMAGES_DIR, originalname), file.buffer);
        this.logger.log(`image '${originalname}' uploaded successfully`);
        return { filename: originalname };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(`error uploading image '${originalname}': ${message}`);
        throw new BadRequestException(message);
      }
    });

    this.uploadChain = work.then(() => undefined, () => undefined);
    return work;
  }

  async reprocessHashtags(): Promise<void> {
    return this.articleLoader.reprocessAllHashtags();
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
