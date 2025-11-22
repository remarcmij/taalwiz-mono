import { Logger } from '@nestjs/common';
import debounce from 'lodash.debounce';
import AutoComplete from '../../dictionary/models/completions.model.js';
import Lemma from '../../dictionary/models/lemma.model.js';
import type { ITopic } from '../models/topic.model.js';
import BaseLoader, { IUpload } from './BaseLoader.js';

const REBUILD_DELAY = 10000; // 10 secs

export interface IDictDataJson {
  baseLang: string;
  lemmas: [
    {
      text: string;
      base: string;
      homonym: number;
      words: [
        {
          word: string;
          lang: string;
          keyword: number;
          order: number;
        },
      ];
    },
  ];
}

class DictLoader extends BaseLoader<IDictDataJson> {
  static debouncedRebuildWordCollection = debounce(async () => {
    const logger = new Logger(DictLoader.name);

    await AutoComplete.deleteMany({});

    const languages = await Lemma.distinct('lang');
    const promises = languages.map(async (lang) => {
      const words = await Lemma.distinct('word', { lang });
      return { lang, words };
    });
    const results = await Promise.all(promises);
    // search.clearAutoCompleteCache();

    const bulk = AutoComplete.collection.initializeUnorderedBulkOp();

    for (const result of results) {
      for (const word of result.words) {
        bulk.insert({ word, lang: result.lang });
      }
    }

    try {
      await bulk.execute();
      logger.log('Auto-complete collection rebuilt');
    } catch (error) {
      logger.error(`auto-complete collection bulk insert error: ${(error as Error).message}`);
    }
  }, REBUILD_DELAY) as () => void;

  protected parseContent(content: string, filename: string): IUpload<IDictDataJson> {
    const payload = JSON.parse(content) as IDictDataJson;

    const match = filename.match(/^[a-z]_(.+)\.json/);
    if (!match) {
      throw new Error(`ill-formed filename: ${filename}`);
    }

    const groupName = match[1];

    return {
      topic: {
        filename: filename,
        type: 'dict',
        groupName,
      } as ITopic,
      payload,
    };
  }

  protected async createData(topic: ITopic, data: IUpload<IDictDataJson>): Promise<void> {
    const bulk = Lemma.collection.initializeUnorderedBulkOp();
    const { lemmas, baseLang } = data.payload;

    for (const lemmaDef of lemmas) {
      for (const wordDef of lemmaDef.words) {
        bulk.insert({
          text: lemmaDef.text,
          word: wordDef.word,
          lang: wordDef.lang,
          keyword: wordDef.keyword !== 0,
          baseWord: lemmaDef.base,
          baseLang: baseLang,
          order: wordDef.order,
          homonym: lemmaDef.homonym,
          groupName: data.topic.groupName,
          _topic: topic._id,
        });
      }
    }

    await bulk.execute();
    DictLoader.debouncedRebuildWordCollection();
  }

  protected async removeData(topic: ITopic): Promise<any> {
    await Lemma.deleteMany({ _topic: topic._id }).exec();
  }
}

export default DictLoader;
