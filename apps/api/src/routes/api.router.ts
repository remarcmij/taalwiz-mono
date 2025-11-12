import express, { NextFunction, Request, Response } from 'express';
import { contact, contactValidations } from '../controllers/auth.controller.js';
import {
  getArticleValidations as articleValidations,
  getArticle,
  getIndexTopics,
  getPublicationTopics,
  getPublicationTopicsValidations,
} from '../controllers/content.controller.js';
import {
  getLemmas,
  getSuggestions,
  lemmasValidations,
  suggestionsValidations,
} from '../controllers/dictionary.controller.js';
import {
  getHashtagIndex,
  searchHashTags,
  searchHashTagsValidations,
} from '../controllers/hashtag.controller.js';
import { validate } from '../util/validate.js';
import adminRouter from './admin.router.js';

const router = express.Router();

const adminGuard = (req: Request, res: Response, next: NextFunction) => {
  // const adminGuard = (req: express.Request, res: Response, next: NextFunction) => {
  if ((req as any).auth?.role === 'admin') {
    return next();
  }
  return res.status(403).send({ message: 'Forbidden' });
};

router
  .get('/topics/index', getIndexTopics)
  .get(
    '/topics/:groupName',
    getPublicationTopicsValidations(),
    validate,
    getPublicationTopics
  )
  .get('/article/:filename', articleValidations(), validate, getArticle)
  .get(
    '/dictionary/suggestions/:text',
    suggestionsValidations(),
    validate,
    getSuggestions
  )
  .get('/dictionary/lookup', lemmasValidations(), validate, getLemmas)
  .get('/hashtags', getHashtagIndex)
  .get('/hashtags/:name', searchHashTagsValidations(), validate, searchHashTags)
  .post('/contact', contactValidations(), validate, contact);

router.use('/admin', adminGuard, adminRouter);

export default router;
