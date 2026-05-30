import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import type { TopicDoc } from '../models/topic.model.js';
import BaseLoader, { Upload } from './BaseLoader.js';
import { PUBLIC_ASSETS_DIR, writeDictManifest } from './manifest-writer.js';

const DictDataTopLevelSchema = z.object({
  targetLang: z.string().min(1),
  lemmas: z.array(z.unknown()),
});

interface DictFileMeta {
  rawContent: string;
}

class DictFileLoader extends BaseLoader<DictFileMeta> {
  protected parseContent(content: string, filename: string): Upload<DictFileMeta> {
    const raw: unknown = JSON.parse(content);
    const result = DictDataTopLevelSchema.safeParse(raw);
    if (!result.success) {
      throw new Error(`invalid dict JSON in ${filename}: ${z.prettifyError(result.error)}`);
    }

    this.assertTargetLang(result.data.targetLang, filename);

    const match = filename.match(/^(.+)\.[a-z]\.json$/);
    if (!match) {
      throw new Error(`ill-formed filename: ${filename}`);
    }
    const groupName = match[1];

    return {
      topic: {
        filename,
        type: 'dict',
        groupName,
        title: groupName.charAt(0).toUpperCase() + groupName.slice(1),
      },
      payload: { rawContent: content },
    };
  }

  protected async createData(_topic: TopicDoc, data: Upload<DictFileMeta>): Promise<void> {
    const filename = data.topic.filename as string;
    await fs.writeFile(path.join(PUBLIC_ASSETS_DIR, filename), data.payload.rawContent, 'utf8');
    await writeDictManifest();
  }

  protected async removeData(topic: TopicDoc): Promise<void> {
    const filename = topic.filename as string;
    await fs.rm(path.join(PUBLIC_ASSETS_DIR, filename), { force: true });
    await writeDictManifest();
  }
}

export default DictFileLoader;
