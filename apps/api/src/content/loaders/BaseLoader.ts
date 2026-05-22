import crypto from 'crypto';
import Topic, { TopicDoc } from '../models/topic.model.js';

export interface Upload<T> {
  topic: Partial<TopicDoc>;
  payload: T;
}
export interface Loader {
  importUpload(filePath: string, originalFilename: string): Promise<boolean>;
}

abstract class BaseLoader<T> implements Loader {
  async importUpload(content: string, originalFilename: string): Promise<boolean> {
    const contentSha = crypto.createHash('md5').update(content).digest('hex');
    const existingTopic = await Topic.findOne({ filename: originalFilename }).exec();
    if (existingTopic?.sha === contentSha) {
      return false;
    }

    const data = await this.parseContent(content, originalFilename);
    if (existingTopic) {
      await this.removeData(existingTopic);
      await Topic.replaceOne(
        { _id: existingTopic._id },
        { ...data.topic, lastModified: Date.now() },
      ).exec();
      await this.createData(existingTopic, data);
    } else {
      const topic = await Topic.create({ ...data.topic, lastModified: Date.now() });
      await this.createData(topic, data);
    }
    return true;
  }

  async removeTopic(topic: TopicDoc): Promise<void> {
    await this.removeData(topic);
    return void Topic.deleteOne({ _id: topic._id }).exec();
  }

  protected abstract parseContent(
    content: string,
    filename: string,
  ): Upload<T> | Promise<Upload<T>>;

  protected abstract createData(topic: TopicDoc, data: Upload<T>): Promise<void>;

  protected abstract removeData(topic: TopicDoc): Promise<void>;
}

export default BaseLoader;
