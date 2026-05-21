import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { FilterQuery } from 'mongoose';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import type { TopicDoc } from './models/topic.model.js';
import EventEmitter from 'node:events';
import ArticleLoader from './loaders/ArticleLoader.js';
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

  private authorizedGroups(user: JwtPayload): string[] | null {
    if (user.roles?.includes('admin')) return null;
    return [...(user.groups ?? []), 'public'];
  }

  async findIndexTopics(user: JwtPayload) {
    const query: FilterQuery<TopicDoc> = { type: 'index' };
    const groups = this.authorizedGroups(user);
    if (groups) query.groupName = { $in: groups };
    return await Topic.find(query).sort({ sortIndex: 1 }).lean();
  }

  async findPublicationTopics(groupName: string, user: JwtPayload) {
    const groups = this.authorizedGroups(user);
    if (groups && !groups.includes(groupName)) {
      throw new ForbiddenException();
    }
    return await Topic.find({ groupName }).sort('sortIndex title').lean();
  }

  async findArticle(filename: string) {
    return await Article.findOne({ filename }).select('-indexText').lean();
  }

  async findContentManifest(user: JwtPayload) {
    const query: FilterQuery<TopicDoc> = { type: { $in: ['article', 'index'] } };
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

  async updateSortIndices(ids: string[]) {
    // Fetch all topics by their IDs to ensure they exist
    const topics = await Promise.all(ids.map((id) => Topic.findById(id).exec()));
    if (topics.includes(null)) {
      throw new Error('One or more topics not found');
    }

    // Update sortIndex for each topic based on its position in the ids array
    Promise.all(
      topics.map((topic, index) => {
        topic!.sortIndex = index;
        return topic!.save();
      }),
    );
  }
}
