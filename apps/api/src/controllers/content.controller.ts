import { RequestHandler } from 'express';
import { Request as JWTRequest } from 'express-jwt';
import { body, param } from 'express-validator';
import EventEmitter from 'node:events';

import ArticleLoader from '../loaders/ArticleLoader.js';
import { ILoader } from '../loaders/BaseLoader.js';
import DictLoader from '../loaders/DictLoader.js';
import Article from '../models/article.model.js';
import Topic from '../models/topic.model.js';
import TaskQueue from '../util/TaskQueue.js';
import logger from '../util/logger.js';

export const uploadEventEmitter = new EventEmitter();
const articleLoader = new ArticleLoader();
const dictLoader = new DictLoader();

const CONCURRENCY = 2;

const taskQueue = new TaskQueue<void>(CONCURRENCY);

export const getIndexTopics: RequestHandler = async (req: JWTRequest, res) => {
  try {
    const topics = await Topic.find({ type: 'index' })
      .sort({ sortIndex: 1 })
      .lean();
    res.json(topics);
    logger.debug(`getIndexTopics ${topics.length}`, {
      email: req.auth?.email,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error('getIndexTopics', {
      email: req.auth?.email,
      error: error.message,
    });
  }
};

export const updateSortIndicesValidations = () => [
  body('ids.*.id').isMongoId(),
];

export const updateSortIndices: RequestHandler<
  any,
  any,
  { ids: { id: string }[] }
> = async (req, res) => {
  const { ids } = req.body;
  try {
    await Promise.all(
      ids.map(async (id, index) => {
        const doc = await Topic.findById(id.id).exec();
        if (!doc) {
          throw new Error(`Document not found ${id.id}`);
        }
        doc.sortIndex = index;
        return doc.save();
      })
    );

    logger.debug('updateSortIndices', 'success');
    res.json({ message: 'OK' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error('updateSortIndices', {
      error: error.message,
    });
  }
};

export const getArticleValidations = () => [param('filename').notEmpty()];

type ArticleParams = { filename: string };

export const getArticle: RequestHandler<ArticleParams> = async (
  req: JWTRequest,
  res
) => {
  try {
    const article = await Article.findOne({ filename: req.params.filename })
      .select('-indexText')
      .lean();

    if (!article) {
      res.status(404).json({ message: 'Not found' });
      return;
    }

    res.json(article);
    logger.debug(`getArticle ${article.title}`, { email: req.auth?.email });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error(`getArticle ${req.params.filename}`, {
      email: req.auth?.email,
      error: error.message,
    });
  }
};

export const getPublicationTopicsValidations = () => [
  param('groupName').notEmpty(),
];

type PublicationTopicsParams = { publication: string };

export const getPublicationTopics: RequestHandler<
  PublicationTopicsParams
> = async (req: JWTRequest, res) => {
  const { groupName } = req.params;

  try {
    const topics = await Topic.find({ groupName })
      .sort('sortIndex title')
      .lean();
    res.json(topics);
    logger.debug(`getPublicationTopics ${groupName} ${topics.length}`, {
      email: req.auth?.email,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
    logger.error(`getPublicationTopics ${groupName}`, {
      email: req.auth?.email,
      error: error.message,
    });
  }
};

export const uploadTopic: RequestHandler = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file provided' });
  }

  let loader: ILoader;
  if (/\.json$/.test(req.file.originalname)) {
    loader = dictLoader;
  } else if (/\.md$/.test(req.file.originalname)) {
    loader = articleLoader;
  } else {
    return res.status(400).json({ message: 'Invalid upload file type' });
  }

  const data = req.file.buffer.toString('utf8');

  uploadEventEmitter.emit('upload', req.file.originalname);

  taskQueue.pushTask(async () => {
    if (!req.file) return;
    try {
      await loader.importUpload(data, req.file.originalname);
      logger.info(`file '${req.file.originalname}' uploaded successfully`);
      res.json({ filename: req.file.originalname });
    } catch (error: any) {
      let message: string;
      if (error.name === 'ValidationError') {
        message = error.toString();
      } else {
        message = error.message;
      }
      logger.error(
        `error uploading file '${req.file.originalname}': ${message}`
      );
      res.status(400).json({ message: message });
    }
  });
};

export const removeTopicValidations = () => [param('filename').notEmpty()];

type RemoveTopicParams = { filename: string };

export const removeTopic: RequestHandler<RemoveTopicParams> = async (
  req,
  res
) => {
  const filename = req.params.filename;
  const topic = await Topic.findOne({ filename: filename }).exec();
  if (!topic) {
    res.status(404).json({ message: 'Topic Not found' });
    logger.error(`removeTopic: topic not found ${filename}`);
    return;
  }

  try {
    await articleLoader.removeTopic(topic);
    res.json(topic);
    logger.info(`removeTopic: ${topic.filename}`);
  } catch (error: any) {
    res.status(500).send(error.message);
    logger.error(`removeTopic: ${topic.filename}`, { error: error.message });
  }
};
