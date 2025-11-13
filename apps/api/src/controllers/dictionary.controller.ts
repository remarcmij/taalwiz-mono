import type { Request, Response } from 'express';
import { param, query } from 'express-validator';
import { LRUCache } from 'lru-cache';
import Lemma from '../models/lemma.model.js';
import Suggestion, { ISuggestion } from '../models/suggestion.model.js';
import logger from '../util/logger.js';
import { uploadEventEmitter } from './content.controller.js';

const validTermRegex = /^[-'()\p{L}]+$/u;

interface SuggestionsResponse {
  term: string;
  suggestions: Array<ISuggestion>;
}

const autoCompleteCache = new LRUCache<string, SuggestionsResponse>({
  max: 500,
  ttl: 1000 * 60 * 60,
});

type SearchRequestQuery = {
  word: string;
  lang: string;
  keyword?: string;
  skip?: string;
  limit?: string;
};

export const lemmasValidations = () => [
  param('word').notEmpty(),
  param('lang').isISO6391(),
  query('keyword').optional().isInt({ min: 0, max: 1 }),
  query('skip').optional().isInt({ min: 0 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
];

type GetLemmasRequest = Request<
  { word: string; lang: string },
  never,
  never,
  SearchRequestQuery
>;

export const getLemmas = async (req: GetLemmasRequest, res: Response) => {
  const words = req.params.word.split(',');

  const searchRequest: SearchRequestQuery = {
    word: '',
    lang: req.params.lang,
  };

  if (req.query.keyword) {
    searchRequest.keyword = req.query.keyword;
  }

  if (req.query.skip) {
    searchRequest.skip = req.query.skip;
  }

  if (req.query.limit) {
    searchRequest.limit = req.query.limit;
  }

  for (const word of words) {
    searchRequest.word = word;
    const lemmas = await execSearchRequest(searchRequest);
    const haveMore = searchRequest.limit
      ? lemmas.length === Number(searchRequest.limit)
      : false;

    if (lemmas.length) {
      res.json({ word, lang: req.params.lang, lemmas, haveMore });
      return;
    }
  }

  res.json({ lemmas: [], haveMore: false });
};

uploadEventEmitter.on('upload', (filename: string) => {
  if (filename.endsWith('.json')) {
    logger.silly('Clearing suggestion cache');
    autoCompleteCache.clear();
  }
});

function execSearchRequest(searchRequest: SearchRequestQuery) {
  const { word, keyword, lang, limit, skip } = searchRequest;

  const condition: any = { word, lang };

  if (searchRequest.keyword) {
    condition.keyword = Number(keyword) !== 0;
  }

  if (typeof skip === 'number' && typeof limit === 'number') {
    return Lemma.find(condition)
      .sort('word order')
      .skip(skip)
      .limit(limit)
      .lean()
      .exec();
  } else {
    return Lemma.find(condition).sort('word order').lean().exec();
  }
}

export const suggestionsValidations = () => [param('term').notEmpty()];

type GetSuggestionsRequest = Request<{ term: string }>;

export const getSuggestions = (req: GetSuggestionsRequest, res: Response) => {
  const term = req.params.term.trim();
  if (term.length === 0 || !validTermRegex.test(term)) {
    return void res.json([]);
  }

  const cachedResult = autoCompleteCache.get(term);

  if (cachedResult) {
    logger.silly(`cache hit for '${term}'`);
    res.json(cachedResult.suggestions);
  } else {
    Suggestion.find({ word: { $regex: '^' + term, $options: 'i' } })
      .collation({ locale: 'nl', strength: 1 })
      .limit(10)
      .lean()
      .then((suggestions) => {
        const result = { term, suggestions };
        autoCompleteCache.set(term, result);
        logger.silly(`cache store for '${term}'`);
        res.json(suggestions);
      });
  }
};
