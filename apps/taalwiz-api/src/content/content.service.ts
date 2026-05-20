import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
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

  async findIndexTopics() {
    return await Topic.find({ type: 'index' }).sort({ sortIndex: 1 }).lean();
  }

  async findPublicationTopics(groupName: string) {
    return await Topic.find({ groupName }).sort('sortIndex title').lean();
  }

  async findArticle(filename: string) {
    return await Article.findOne({ filename }).select('-indexText').lean();
  }

  async findContentManifest() {
    return await Topic.find({ type: { $in: ['article', 'index'] } })
      .select('filename sha -_id')
      .lean();
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
