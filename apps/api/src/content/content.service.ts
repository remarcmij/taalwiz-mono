import { BadRequestException, ForbiddenException, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import type { FilterQuery } from 'mongoose';
import { authorizedGroups } from '../auth/authorized-groups.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import type { TopicDoc } from './models/topic.model.js';
import EventEmitter from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { LRUCache } from 'lru-cache';
import ArticleLoader, { renderArticleHtml } from './loaders/ArticleLoader.js';
import { Loader } from './loaders/BaseLoader.js';
import DictLoader from './loaders/DictLoader.js';
import Article from './models/article.model.js';
import Topic from './models/topic.model.js';

const IMAGE_EXT_PATTERN = /\.(jpe?g|png|gif|webp)$/i;
const IMAGES_DIR = path.join(import.meta.dirname, '..', '..', 'public/assets/images');

// Help articles bundled with the app. They are copied into dist as build
// assets (see nest-cli.json) and seeded into the DB on boot so a fresh
// deployment or post-reset database always has working /help/{lang} pages
// without a manual admin upload.
const SEEDS_DIR = path.join(import.meta.dirname, 'seeds');
const HELP_SEED_FILES = ['help.en.md', 'help.nl.md'];

@Injectable()
export class ContentService implements OnApplicationBootstrap {
  // Notifies the admin SSE stream (see the controller) when an upload starts,
  // so the UI can reflect in-flight imports.
  public readonly uploadEventEmitter = new EventEmitter();
  private readonly articleLoader = new ArticleLoader();
  private readonly dictLoader = new DictLoader();
  // Serializes all uploads into a single chain so concurrent imports can't
  // interleave their DB writes. See uploadContent for how it stays resolved.
  private uploadChain: Promise<void> = Promise.resolve();
  private readonly logger = new Logger(ContentService.name);
  // Rendered-HTML cache keyed by filename; avoids re-running the markdown
  // pipeline on every article fetch. Cleared wholesale on any upload.
  readonly #htmlCache = new LRUCache<string, string>({ max: 500 });

  async onApplicationBootstrap(): Promise<void> {
    await this.#seedHelpArticles();
  }

  // Idempotent: ArticleLoader.importUpload no-ops when the file's MD5 matches
  // the stored topic, so this only writes on a fresh DB or when the bundled
  // help text actually changed in a deploy. A missing seed file is logged and
  // skipped rather than crashing startup.
  async #seedHelpArticles(): Promise<void> {
    for (const filename of HELP_SEED_FILES) {
      try {
        const content = await fs.readFile(path.join(SEEDS_DIR, filename), 'utf8');
        const changed = await this.articleLoader.importUpload(content, filename);
        this.logger.log(
          changed ? `seeded help article '${filename}'` : `help article '${filename}' already up to date`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.warn(`could not seed help article '${filename}': ${message}`);
      }
    }
  }

  // Lists the publications (manifests) a user may see. The `main` topic holds
  // the canonical ordered list of all group names; `authorizedGroups` returns
  // null for admins (see all) or a group allowlist for everyone else. We map
  // over the ordered group list rather than the manifest query result so the
  // returned publications preserve the intended display order.
  async findPublications(user: JwtPayload) {
    const mainManifest = await Topic.findOne({ type: 'main' }).lean();
    if (!mainManifest?.groups?.length) {
      return [];
    }
    const groups = authorizedGroups(user);
    const authorizedGroupList = groups
      ? mainManifest.groups.filter((g) => groups.includes(g))
      : mainManifest.groups;

    const manifests = await Topic.find({
      type: 'manifest',
      groupName: { $in: authorizedGroupList },
    }).lean();

    return authorizedGroupList
      .map((g) => manifests.find((m) => m.groupName === g))
      .filter((m): m is NonNullable<typeof m> => m != null);
  }

  // Returns the manifest plus its articles for one publication, with the
  // articles in the order the manifest declares. Falls back to the raw
  // (unordered) article list if the group has no manifest. The leading
  // manifest topic lets the client render the publication's own metadata.
  async findPublicationTopics(groupName: string, user: JwtPayload) {
    const groups = authorizedGroups(user);
    if (groups && !groups.includes(groupName)) {
      throw new ForbiddenException();
    }

    const manifestTopic = await Topic.findOne({ type: 'manifest', groupName }).lean();
    const articles = await Topic.find({ type: 'article', groupName }).lean();

    if (!manifestTopic) {
      return articles;
    }

    const ordered = (manifestTopic.articles ?? [])
      .map((name) => articles.find((a) => a.filename === `${groupName}.${name}.md`))
      .filter((a): a is NonNullable<typeof a> => a != null);

    return [manifestTopic, ...ordered];
  }

  // Fetches a single article and its rendered HTML. `indexText` (the hashtag
  // search index) is excluded as it's irrelevant to rendering; `mdText` is
  // stripped from the response after rendering so only `htmlText` ships.
  async findArticle(filename: string, user: JwtPayload) {
    const normalizedFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    const article = await Article.findOne({ filename: normalizedFilename }).select('-indexText').lean();
    if (!article) return null;

    // `help` articles are universal UI documentation, readable by any
    // authenticated user regardless of group membership (cf. the target-lang
    // exemption for `help` in ArticleLoader).
    const groups = authorizedGroups(user);
    if (groups && article.groupName !== 'help' && !groups.includes(article.groupName)) {
      throw new ForbiddenException();
    }

    const htmlText = await this.#getHtml(article.filename, article.mdText);
    const { mdText: _mdText, ...rest } = article;
    return { ...rest, htmlText };
  }

  // Memoized markdown-to-HTML render. Keyed by filename since an article's
  // markdown only changes via an upload, which clears the whole cache.
  async #getHtml(filename: string, mdText: string): Promise<string> {
    const cached = this.#htmlCache.get(filename);
    if (cached !== undefined) return cached;
    const html = await renderArticleHtml(mdText, filename);
    this.#htmlCache.set(filename, html);
    return html;
  }

  // Lightweight filename+sha listing used by the client to detect which cached
  // topics are stale. Returns only the fields needed for that diff (no _id).
  async findContentManifest(user: JwtPayload) {
    const query: FilterQuery<TopicDoc> = { type: { $in: ['article', 'manifest', 'main'] } };
    const groups = authorizedGroups(user);
    if (groups) query.groupName = { $in: groups };
    return await Topic.find(query).select('filename sha -_id').lean();
  }

  // Only groups backed by a manifest are real, assignable publications. A bare
  // `distinct('groupName')` also surfaces the structural `main` index, the
  // `dict` dictionaries (open to every logged-in user, never group-gated), the
  // manifest-less `help` docs (universal UI documentation), and stale
  // pre-manifest groups left over from early uploads — for none of which does
  // group membership gate anything, so none belong in the admin "Manage Groups"
  // picker.
  async findGroups(): Promise<string[]> {
    return await Topic.distinct('groupName', { type: 'manifest' }).exec();
  }

  // Admin upload entry point. Dispatches by extension: images go to disk,
  // `.json` to the dictionary loader, `.md` to the article loader. The import
  // is queued onto uploadChain so it runs after any in-flight upload, and the
  // HTML cache is cleared up front since an import may change any article.
  async uploadContent(file: Express.Multer.File): Promise<{ filename: string }> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    if (IMAGE_EXT_PATTERN.test(file.originalname)) {
      return this.#uploadImage(file);
    }

    let loader: Loader;
    if (/\.json$/.test(file.originalname)) {
      loader = this.dictLoader;
    } else if (/\.md$/.test(file.originalname)) {
      loader = this.articleLoader;
    } else {
      throw new BadRequestException('Invalid upload file type');
    }

    const data = file.buffer.toString('utf8');
    this.uploadEventEmitter.emit('upload', file.originalname);
    this.#htmlCache.clear();

    const work = this.uploadChain.then(async () => {
      try {
        await loader.importUpload(data, file.originalname);
        this.logger.log(`file '${file.originalname}' uploaded successfully`);
        return { filename: file.originalname };
      } catch (err) {
        const message = err instanceof Error
          ? err.name === 'ValidationError' ? err.toString() : err.message
          : 'unknown error';
        this.logger.error(`error uploading file '${file.originalname}': ${message}`);
        throw new BadRequestException(message);
      }
    });

    // Keep the chain resolved so a failed upload doesn't block subsequent ones.
    this.uploadChain = work.then(() => undefined, () => undefined);
    return work;
  }

  // Writes a publication image straight to the public images dir. The filename
  // comes from the client, so reject any path separators or `..` to prevent a
  // path-traversal write outside IMAGES_DIR.
  #uploadImage(file: Express.Multer.File): Promise<{ filename: string }> {
    const { originalname } = file;
    if (originalname.includes('/') || originalname.includes('\\') || originalname.includes('..')) {
      throw new BadRequestException('Invalid image filename');
    }

    this.uploadEventEmitter.emit('upload', originalname);

    const work = this.uploadChain.then(async () => {
      try {
        await fs.mkdir(IMAGES_DIR, { recursive: true });
        await fs.writeFile(path.join(IMAGES_DIR, originalname), file.buffer);
        this.logger.log(`image '${originalname}' uploaded successfully`);
        return { filename: originalname };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'unknown error';
        this.logger.error(`error uploading image '${originalname}': ${message}`);
        throw new BadRequestException(message);
      }
    });

    this.uploadChain = work.then(() => undefined, () => undefined);
    return work;
  }

  // Admin maintenance action: rebuild the hashtag search index across all
  // articles (e.g. after changing the hashtag extraction rules).
  async reprocessHashtags(): Promise<void> {
    return this.articleLoader.reprocessAllHashtags();
  }

  // Deletes a topic and its associated records via the loader that owns it
  // (dict vs article), so any side data the loader tracks is cleaned up too.
  // Returns a Mongo-style deletedCount so a missing topic is a no-op, not an error.
  async deleteTopic(filename: string) {
    const topic = await Topic.findOne({ filename }).exec();
    if (!topic) {
      return { deletedCount: 0 };
    }
    const loader = topic.type === 'dict' ? this.dictLoader : this.articleLoader;
    await loader.removeTopic(topic);
    return { deletedCount: 1 };
  }
}
