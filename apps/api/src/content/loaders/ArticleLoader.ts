import crypto from 'crypto';
import yaml from 'js-yaml';
import { z } from 'zod';

import { Logger } from '@nestjs/common';
import { convertMarkdown } from '../../util/markup.js';
import Article, { ArticleDoc } from '../models/article.model.js';
import Hashtag, { ExtractedHashtag, HashtagDoc } from '../models/hashtag.model.js';
import Topic, { TopicDoc } from '../models/topic.model.js';
import BaseLoader, { Upload } from './BaseLoader.js';

const FrontMatterSchema = z.object({
  author: z.string().optional(),
  chapter: z.string().optional(),
  copyright: z.string().optional(),
  groupName: z.string().optional(),
  isbn: z.string().optional(),
  publicationYear: z.number().int().optional(),
  publisher: z.string().optional(),
  sortIndex: z.number().int().optional(),
  subtitle: z.string().optional(),
  targetLang: z.string().optional(),
  title: z.string().optional(),
});

type FrontMatterAttributes = z.infer<typeof FrontMatterSchema>;

interface ExtractHashtagResult {
  body: string;
  hashtags: ExtractedHashtag[];
}

const createHashtagRegExp = () => /\\?#([-\p{L}0-9]{2,})/gu;

class ArticleLoader extends BaseLoader<ArticleDoc> {
  private readonly logger = new Logger(ArticleLoader.name);

  protected async parseContent(content: string, filename: string): Promise<Upload<ArticleDoc>> {
    let match = filename.match(/^(.+)\.(.+)\.md$/);
    if (!match || match.length < 3) {
      throw new Error(`ill-formed filename: ${filename}`);
    }
    const group = match[1];
    const name = match[2];

    const parts = content.split('---');
    if (parts.length < 3) {
      throw new Error('Content must include front matter enclosed in ---');
    }

    const frontMatter = parts[1];
    const body = parts.slice(2).join('---');

    const rawAttributes: unknown = yaml.load(frontMatter);
    const result = FrontMatterSchema.safeParse(rawAttributes ?? {});
    if (!result.success) {
      throw new Error(
        `invalid front matter in ${filename}: ${z.prettifyError(result.error)}`,
      );
    }
    const attributes: FrontMatterAttributes = result.data;
    let title = attributes.title;

    // If no title is provided, try to extract it from the content
    if (!title) {
      const h1RegExp = /^# *([^#][^\n]+)/m;
      match = content.match(h1RegExp);
      title = 'untitled';
      if (match) {
        title = match[1];
      }
    }

    let subtitle = attributes.subtitle;

    // If no subtitle is provided, try to extract it from the content by
    // concatenating all h2 headers
    if (!subtitle && name !== 'index') {
      const h2RegExp = /^##\s+(.*)$/gm;
      subtitle = '';
      match = h2RegExp.exec(content);

      while (match) {
        if (subtitle.length > 0) {
          subtitle += ' • ';
        }
        subtitle += match[1];
        match = h2RegExp.exec(content);
      }
    }

    const topic: TopicDoc = {
      type: name === 'index' ? 'index' : 'article',
      filename: filename,
      targetLang: attributes.targetLang,
      groupName: group,
      sortIndex: attributes.sortIndex ?? 0,
      title: title,
      subtitle: subtitle,
      author: attributes.author,
      copyright: attributes.copyright,
      publisher: attributes.publisher,
      publicationYear: attributes.publicationYear,
      isbn: attributes.isbn,
      lastModified: Date.now(),
    };

    const article: ArticleDoc = {
      filename: filename,
      targetLang: attributes.targetLang,
      groupName: group,
      title: topic.title ?? 'untitled',
      htmlText: '',
      mdText: body,
      hashtags: [],
    };

    topic.sha = generateChecksum(content);

    const { body: newBody, hashtags } = await this.extractHashtags(body, article);

    article.hashtags = hashtags;

    // add markup for single word hash tags
    content = content.replace(/#[-'a-zA-Z\u00C0-\u00FF]{2,}/g, '<span class="hashtag">$&</span>');

    // add markup for hash tags enclosed in curly brackets (e.g. multi-word)
    content = content.replace(/#\{(.+?)}/g, '<span class="hashtag">#$1</span>');

    article.htmlText = await convertMarkdown(newBody);

    return {
      topic: topic,
      payload: article,
    };
  }

  protected async createData(
    topic: TopicDoc,
    { payload: article }: Upload<ArticleDoc>,
  ): Promise<void> {
    await Article.create({ ...article, _topic: topic._id });
    if (article.hashtags.length > 0) {
      await this.bulkLoadHashTags(article.hashtags, topic);
    }
  }

  protected async removeData(topic: TopicDoc): Promise<void> {
    await Article.deleteOne({ _topic: topic._id }).exec();
    await Hashtag.deleteMany({ _topic: topic._id }).exec();
  }

  private async bulkLoadHashTags(hashtags: ExtractedHashtag[], topic: TopicDoc): Promise<void> {
    const bulk = Hashtag.collection.initializeUnorderedBulkOp();

    for (const hashtag of hashtags) {
      const data: HashtagDoc = {
        name: hashtag.tagname,
        id: hashtag.id,
        publicationTitle: hashtag.publicationTitle,
        sectionHeader: hashtag.sectionHeader,
        groupName: topic.groupName,
        _topic: topic._id,
      };

      bulk.insert(data);
    }

    await bulk.execute();
  }

  private async extractHashtags(body: string, article: ArticleDoc): Promise<ExtractHashtagResult> {
    const hashtagRegExp1 = createHashtagRegExp();
    const hashtagRegExp2 = createHashtagRegExp();
    const outLines: string[] = [];
    const hashtags: ExtractedHashtag[] = [];

    const lines = body.split('\n');
    let sectionHeader = '';

    const indexTopics = await Topic.find({ type: 'index' }).lean();

    const indexTopic = indexTopics.find((topic) => topic.groupName === article.groupName);
    if (!indexTopic) {
      // No index topic found, so no hashtags to extract
      this.logger.warn(`extractHashtags: No index topic found for ${article.groupName}`);
      return { body, hashtags: [] };
    }

    for (const line of lines) {
      hashtagRegExp1.lastIndex = 0;
      let outLine = line;
      // Check for a markdown header
      if (/^#/.test(line)) {
        sectionHeader = line.replace(/^#+/, '').trim();
      } else {
        let match = hashtagRegExp1.exec(line);
        while (match) {
          const tagname = match[1].trim().toLowerCase();

          const id = crypto.randomUUID();
          const hashtag: ExtractedHashtag = {
            tagname: tagname,
            id: id,
            publicationTitle: indexTopic.title,
            articleTitle: article.title,
            sectionHeader: sectionHeader,
          };

          hashtags.push(hashtag);

          outLine = outLine.replace(
            hashtagRegExp2,
            `<span id="_${id}_" class="hashtag">#$1</span>`,
          );
          match = hashtagRegExp1.exec(line);
        }
      }
      outLines.push(outLine);
    }

    return { body: outLines.join('\n'), hashtags };
  }
}

function generateChecksum(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

export default ArticleLoader;
