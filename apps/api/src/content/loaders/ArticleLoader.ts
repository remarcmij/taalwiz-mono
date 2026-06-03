import crypto from 'crypto';
import yaml from 'js-yaml';
import { z } from 'zod';

import { Logger } from '@nestjs/common';
import { convertMarkdown } from '../../util/markup.js';
import Article, { ArticleDoc } from '../models/article.model.js';
import Hashtag, { ExtractedHashtag, HashtagDoc } from '../models/hashtag.model.js';
import Topic, { TopicDoc } from '../models/topic.model.js';
import BaseLoader, { Upload } from './BaseLoader.js';

const ArticleFrontMatterSchema = z.object({
  author: z.string().optional(),
  copyright: z.string().optional(),
  groupName: z.string().optional(),
  image: z.string().optional(),
  isbn: z.string().optional(),
  publicationYear: z.number().int().optional(),
  publisher: z.string().optional(),
  subtitle: z.string().optional(),
  targetLang: z.string().optional(),
  title: z.string().optional(),
});

const ManifestFrontMatterSchema = ArticleFrontMatterSchema.extend({
  articles: z.array(z.string()).optional(),
  groups: z.array(z.string()).optional(),
});

type ArticleFrontMatterAttributes = z.infer<typeof ArticleFrontMatterSchema>;
type ManifestFrontMatterAttributes = z.infer<typeof ManifestFrontMatterSchema>;

interface ExtractHashtagResult {
  hashtags: ExtractedHashtag[];
}

const createHashtagRegExp = () => /\\?#(?:\{([-\p{L}0-9 ]{2,})\}|([-\p{L}0-9]{2,}))/gu;

function deterministicHashtagId(filename: string, tagname: string, occurrence: number): string {
  return crypto.createHash('sha256').update(`${filename}:${tagname}:${occurrence}`).digest('hex').slice(0, 24);
}

// An ATX heading marker (`#`..`######` followed by whitespace). We keep the
// marker intact but still scan the heading *text* for hashtags, so a tag can
// live inside a heading. Splitting the marker off first stops the marker itself
// from being mistaken for a hashtag.
const HEADING_PREFIX_RE = /^(#{1,6}\s+)([\s\S]*)$/;

function splitHeadingPrefix(line: string): { prefix: string; text: string } {
  const match = HEADING_PREFIX_RE.exec(line);
  return match ? { prefix: match[1], text: match[2] } : { prefix: '', text: line };
}

// Reduce hashtag markup to its bare word(s) for use as a plain section label:
// `#selamat` -> `selamat`, `#{selamat pagi}` -> `selamat pagi`.
function stripHashtagMarkup(text: string): string {
  return text
    .replace(createHashtagRegExp(), (fullMatch, bracedName: string | undefined, plainName: string | undefined) =>
      fullMatch.startsWith('\\') ? fullMatch : (bracedName ?? plainName ?? fullMatch),
    )
    .trim();
}

export function applyHashtagSpans(body: string, filename: string): string {
  const occurrenceMap = new Map<string, number>();
  return body
    .split('\n')
    .map((line) => {
      const { prefix, text } = splitHeadingPrefix(line);
      const replaced = text.replace(createHashtagRegExp(), (fullMatch, bracedName: string | undefined, plainName: string | undefined) => {
        if (fullMatch.startsWith('\\')) return fullMatch;
        const tagname = (bracedName ?? plainName ?? '').toLowerCase().trim();
        const occ = occurrenceMap.get(tagname) ?? 0;
        occurrenceMap.set(tagname, occ + 1);
        return `<span id="_${deterministicHashtagId(filename, tagname, occ)}_" class="hashtag">#${tagname}</span>`;
      });
      return prefix + replaced;
    })
    .join('\n');
}

export async function renderArticleHtml(mdText: string, filename: string): Promise<string> {
  return convertMarkdown(applyHashtagSpans(mdText, filename));
}

class ArticleLoader extends BaseLoader<ArticleDoc> {
  private readonly logger = new Logger(ArticleLoader.name);

  protected async parseContent(content: string, filename: string): Promise<Upload<ArticleDoc>> {
    const match = filename.match(/^(.+)\.(.+)\.md$/);
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

    if (name === 'manifest') {
      return this.parseManifest(content, filename, group, body, rawAttributes);
    }

    return this.parseArticle(content, filename, group, body, rawAttributes);
  }

  private async parseManifest(
    content: string,
    filename: string,
    group: string,
    body: string,
    rawAttributes: unknown,
  ): Promise<Upload<ArticleDoc>> {
    const result = ManifestFrontMatterSchema.safeParse(rawAttributes ?? {});
    if (!result.success) {
      throw new Error(`invalid front matter in ${filename}: ${z.prettifyError(result.error)}`);
    }
    const attributes: ManifestFrontMatterAttributes = result.data;

    const isMain = group === 'main';
    // Group manifests must declare a matching target language; the main
    // manifest is a language-agnostic index and is exempt.
    if (!isMain) {
      this.assertTargetLang(attributes.targetLang, filename);
    }
    const h1Match = body.match(/^# *([^#][^\n]+)/m);
    const title = attributes.title ?? (h1Match ? h1Match[1].trim() : (isMain ? 'Main Manifest' : group));

    const topic: TopicDoc = {
      type: isMain ? 'main' : 'manifest',
      filename,
      groupName: group,
      title,
      subtitle: attributes.subtitle,
      author: attributes.author,
      copyright: attributes.copyright,
      publisher: attributes.publisher,
      publicationYear: attributes.publicationYear,
      isbn: attributes.isbn,
      image: isMain ? undefined : attributes.image,
      sha: generateChecksum(content),
      lastModified: Date.now(),
      articles: isMain ? undefined : (attributes.articles ?? []),
      groups: isMain ? (attributes.groups ?? []) : undefined,
    };

    const article: ArticleDoc = {
      filename,
      groupName: group,
      title,
      mdText: body,
      hashtags: [],
    };

    return { topic, payload: article };
  }

  private async parseArticle(
    content: string,
    filename: string,
    group: string,
    body: string,
    rawAttributes: unknown,
  ): Promise<Upload<ArticleDoc>> {
    const result = ArticleFrontMatterSchema.safeParse(rawAttributes ?? {});
    if (!result.success) {
      throw new Error(`invalid front matter in ${filename}: ${z.prettifyError(result.error)}`);
    }
    const attributes: ArticleFrontMatterAttributes = result.data;

    this.assertTargetLang(attributes.targetLang, filename);

    const titleMatch = content.match(/^# *([^#][^\n]+)/m);
    const title = attributes.title ?? (titleMatch ? titleMatch[1] : 'untitled');

    let subtitle = attributes.subtitle;
    if (!subtitle) {
      const h2RegExp = /^##\s+(.*)$/gm;
      subtitle = '';
      let h2Match = h2RegExp.exec(content);
      while (h2Match) {
        if (subtitle.length > 0) subtitle += ' • ';
        subtitle += h2Match[1];
        h2Match = h2RegExp.exec(content);
      }
    }

    const topic: TopicDoc = {
      type: 'article',
      filename,
      groupName: group,
      title,
      subtitle,
      author: attributes.author,
      copyright: attributes.copyright,
      publisher: attributes.publisher,
      publicationYear: attributes.publicationYear,
      isbn: attributes.isbn,
      sha: generateChecksum(content),
      lastModified: Date.now(),
    };

    const article: ArticleDoc = {
      filename,
      groupName: group,
      title,
      mdText: body,
      hashtags: [],
    };

    const { hashtags } = await this.extractHashtags(body, article);
    article.hashtags = hashtags;

    return { topic, payload: article };
  }

  protected async createData(
    topic: TopicDoc,
    { payload: article }: Upload<ArticleDoc>,
  ): Promise<void> {
    if (topic.type === 'main') {
      return;
    }
    await Article.create({ ...article, _topic: topic._id });
    if (article.hashtags.length > 0) {
      await this.bulkLoadHashTags(article.hashtags, topic);
    }
    if (topic.type === 'manifest') {
      await this.reprocessGroupHashtags(topic);
    }
  }

  async reprocessAllHashtags(): Promise<void> {
    const articles = await Article.find().lean();
    this.logger.log(`reprocessing hashtags for ${articles.length} article(s)`);
    for (const stored of articles) {
      await Hashtag.deleteMany({ _topic: stored._topic }).exec();
      const articleDoc: ArticleDoc = {
        filename: stored.filename,
        groupName: stored.groupName,
        title: stored.title,
        mdText: stored.mdText,
        hashtags: [],
      };
      const { hashtags } = await this.extractHashtags(stored.mdText, articleDoc);
      if (hashtags.length > 0) {
        const topicRef = { _id: stored._topic, groupName: stored.groupName } as TopicDoc;
        await this.bulkLoadHashTags(hashtags, topicRef);
      }
    }
  }

  private async reprocessGroupHashtags(manifestTopic: TopicDoc): Promise<void> {
    const articles = await Article.find({
      groupName: manifestTopic.groupName,
      filename: { $ne: manifestTopic.filename },
    }).lean();

    if (articles.length === 0) return;

    this.logger.log(
      `reprocessing hashtags for ${articles.length} article(s) in group '${manifestTopic.groupName}'`,
    );

    for (const stored of articles) {
      await Hashtag.deleteMany({ _topic: stored._topic }).exec();

      const articleDoc: ArticleDoc = {
        filename: stored.filename,
        groupName: stored.groupName,
        title: stored.title,
        mdText: stored.mdText,
        hashtags: [],
      };

      const { hashtags } = await this.extractHashtags(stored.mdText, articleDoc);

      if (hashtags.length > 0) {
        const articleTopicRef = { _id: stored._topic, groupName: stored.groupName } as TopicDoc;
        await this.bulkLoadHashTags(hashtags, articleTopicRef);
      }
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
    const hashtags: ExtractedHashtag[] = [];

    const manifestTopic = await Topic.findOne({
      type: 'manifest',
      groupName: article.groupName,
    }).lean();

    if (!manifestTopic) {
      this.logger.warn(`extractHashtags: No manifest topic found for ${article.groupName}`);
      return { hashtags: [] };
    }

    const occurrenceMap = new Map<string, number>();
    let sectionHeader = '';

    for (const line of body.split('\n')) {
      const { prefix, text } = splitHeadingPrefix(line);
      // A heading both updates the current section label and may itself carry a
      // hashtag, so we set the label first, then scan the same text below.
      if (prefix) {
        sectionHeader = stripHashtagMarkup(text);
      }
      text.replace(createHashtagRegExp(), (fullMatch, bracedName: string | undefined, plainName: string | undefined) => {
        if (fullMatch.startsWith('\\')) return fullMatch;
        const tagname = (bracedName ?? plainName ?? '').toLowerCase().trim();
        const occ = occurrenceMap.get(tagname) ?? 0;
        occurrenceMap.set(tagname, occ + 1);
        hashtags.push({
          tagname,
          id: deterministicHashtagId(article.filename, tagname, occ),
          publicationTitle: manifestTopic.title,
          articleTitle: article.title,
          sectionHeader,
        });
        return fullMatch;
      });
    }

    return { hashtags };
  }
}

function generateChecksum(content: string): string {
  return crypto.createHash('md5').update(content).digest('hex');
}

export default ArticleLoader;
