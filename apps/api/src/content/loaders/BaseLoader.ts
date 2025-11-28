import Topic, { TopicDoc } from '../models/topic.model.js';

export interface IUpload<T> {
  topic: TopicDoc;
  payload: T;
}
export interface ILoader {
  importUpload(filePath: string, originalFilename: string): Promise<void>;
  removeTopic(topic: TopicDoc): Promise<void>;
}

abstract class BaseLoader<T> implements ILoader {
  async importUpload(content: string, originalFilename: string): Promise<void> {
    const data = await this.parseContent(content, originalFilename);
    let topic = await Topic.findOne({ filename: originalFilename }).exec();
    if (topic) {
      await this.removeData(topic);
      await Topic.replaceOne(
        { _id: topic._id },
        { ...data.topic, lastModified: Date.now() },
      ).exec();
    } else {
      topic = await Topic.create({ ...data.topic, lastModified: Date.now() });
    }
    await this.createData(topic, data);
  }

  async removeTopic(topic: TopicDoc): Promise<any> {
    await this.removeData(topic);
    return Topic.deleteOne({ _id: topic._id }).exec();
  }

  protected abstract parseContent(
    content: string,
    filename: string,
  ): IUpload<T> | Promise<IUpload<T>>;
  protected abstract createData(topic: TopicDoc, data: IUpload<T>): Promise<void>;
  protected abstract removeData(topic: TopicDoc): Promise<void>;
}

export default BaseLoader;
