import debounce from 'lodash.debounce';
import logger from '../util/logger.js';
// import * as search from '../dict/search';
import Lemma from '../models/lemma.model.js';
import Suggestion from '../models/suggestion.model.js';
import type { ITopic } from '../models/topic.model.js';
import BaseLoader from './BaseLoader.js';

const REBUILD_DELAY = 10000; // 10 secs

export interface IUpload<T> {
  topic: ITopic;
  payload: T;
}

const debouncedRebuildWordCollection = debounce(async () => {
  await Suggestion.deleteMany({});
  const languages = await Lemma.distinct('lang');
  const promises = languages.map(async (lang) => {
    const words = await Lemma.distinct('word', { lang });
    return { lang, words };
  });
  const results = await Promise.all(promises);
  // search.clearAutoCompleteCache();

  const bulk = Suggestion.collection.initializeUnorderedBulkOp();

  for (const result of results) {
    for (const word of result.words) {
      bulk.insert({ word, lang: result.lang });
    }
  }

  try {
    await bulk.execute();
    logger.info(`auto-complete collection rebuilt`);
  } catch (error: any) {
    logger.error(
      `auto-complete collection bulk insert error: ${error.message}`
    );
  }
}, REBUILD_DELAY);

export interface IDictDataJson {
  groupName: string;
  baseLang: string;
  lemmas: [
    {
      base: string;
      homonym: number;
      text: string;
      words: [
        {
          word: string;
          attr: string;
          lang: string;
          order: number;
        },
      ];
    },
  ];
}

class DictLoader extends BaseLoader<IDictDataJson> {
  protected async parseContent(
    content: string,
    filename: string
  ): Promise<IUpload<IDictDataJson>> {
    const payload: IDictDataJson = JSON.parse(content);

    const match = filename.match(/(.+)_(.+)\./);
    if (!match) {
      throw new Error(`ill-formed filename: ${filename}`);
    }

    const groupName = match[2];

    return {
      topic: {
        filename: filename,
        type: 'dict',
        groupName,
      } as ITopic,
      payload,
    };
  }

  protected async createData(
    topic: ITopic,
    data: IUpload<IDictDataJson>
  ): Promise<void> {
    const bulk = Lemma.collection.initializeUnorderedBulkOp();
    const { lemmas, baseLang } = data.payload;

    for (const lemmaDef of lemmas) {
      for (const wordDef of lemmaDef.words) {
        bulk.insert({
          baseWord: lemmaDef.base,
          homonym: lemmaDef.homonym,
          text: lemmaDef.text,
          word: wordDef.word,
          attr: wordDef.attr,
          order: wordDef.order,
          lang: wordDef.lang,
          baseLang: baseLang,
          groupName: data.topic.groupName,
          _topic: topic._id,
        });
      }
    }

    await bulk.execute();
    debouncedRebuildWordCollection();
  }

  protected async removeData(topic: ITopic): Promise<any> {
    await Lemma.deleteMany({ _topic: topic._id }).exec();
  }
}

export default DictLoader;
