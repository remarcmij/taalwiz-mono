import type { InferSchemaType } from 'mongoose';
import { model, Schema, Types } from 'mongoose';

const TopicSchema = new Schema({
  articles: { type: [String], default: undefined },
  author: String,
  copyright: String,
  filename: { type: String, required: true, unique: true },
  groupName: { type: String, required: true },
  groups: { type: [String], default: undefined },
  image: String,
  isbn: String,
  lastModified: { type: Number, default: Date.now() },
  publicationYear: Number,
  publisher: String,
  sha: String,
  subtitle: String,
  targetLang: String,
  title: { type: String, required: true },
  type: { type: String, required: true, enum: ['main', 'manifest', 'article', 'dict'] },
});

export type TopicDoc = Omit<InferSchemaType<typeof TopicSchema>, 'articles' | 'groups'> & {
  _id?: Types.ObjectId;
  articles?: string[] | null;
  groups?: string[] | null;
};

const Topic = model('Topic', TopicSchema);

export default Topic;
