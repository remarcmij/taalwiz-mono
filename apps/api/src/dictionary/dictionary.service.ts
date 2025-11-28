import { Inject, Injectable, Logger } from '@nestjs/common';
import Lemma from './models/lemma.model.js';

import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { ContentService } from '../content/content.service.js';
import { FindWordParamsDto } from './dto/find-word-params.dto.js';
import { FindWordQueryDto } from './dto/find-word-query.dto.js';
import AutoCompletions, { AutoCompletionDoc } from './models/completions.model.js';

interface Condition {
  word: string;
  lang: string;
  keyword?: boolean;
}

const validTermRegex = /^[-'()\p{L}]+$/u;

@Injectable()
export class DictionaryService {
  private readonly logger = new Logger(DictionaryService.name);

  constructor(
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly contentService: ContentService,
  ) {
    this.contentService.uploadEventEmitter.on('upload', (filename: string) => {
      this.logger.log(`Clearing dictionary cache due to upload of '${filename}'`);
      void this.cacheManager.clear();
    });
  }

  async findWord(paramsDto: FindWordParamsDto, queryDto: FindWordQueryDto): Promise<any> {
    const words = paramsDto.word.split(',');

    for (const word of words) {
      const lemmas = await this.findWordHelper(
        word,
        paramsDto.lang,
        queryDto.keyword,
        queryDto.skip,
        queryDto.limit,
      );
      const haveMore = queryDto.limit ? lemmas.length === queryDto.limit : false;

      if (lemmas.length) {
        return { word: word, lang: paramsDto.lang, lemmas, haveMore };
      }
    }

    return { lemmas: [], haveMore: false };
  }

  async findAutoCompletions(term: string) {
    if (term.length === 0 || !validTermRegex.test(term)) {
      return [];
    }

    const cachedResult = (await this.cacheManager.get(term)) as AutoCompletionDoc;

    if (cachedResult) {
      this.logger.debug(`Cache hit for '${term}'`);
      return cachedResult;
    } else {
      const completions = await AutoCompletions.find({
        word: { $regex: '^' + term, $options: 'i' },
      })
        .sort('word')
        .limit(10)
        .lean();

      await this.cacheManager.set(term, completions);
      this.logger.debug(`Cache store for '${term}'`);
      return completions;
    }
  }

  private async findWordHelper(
    word: string,
    lang: string,
    keyword?: number,
    skip?: number,
    limit?: number,
  ): Promise<any[]> {
    const condition: Condition = { word, lang };

    if (typeof keyword === 'number') {
      condition.keyword = keyword !== 0;
    }

    const query = Lemma.find(condition)
      .sort('word order')
      .select('-order -attr -groupName -keyword -_topic');

    if (typeof skip === 'number') {
      query.skip(skip);
    }

    if (typeof limit === 'number') {
      query.limit(limit);
    }

    return query.lean().exec();
  }
}
