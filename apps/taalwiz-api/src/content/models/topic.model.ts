import type { InferSchemaType } from 'mongoose';
import { model, Schema, Types } from 'mongoose';

const TopicSchema = new Schema({
  author: String,
  baseLang: String,
  copyright: String,
  filename: { type: String, required: true, unique: true },
  foreignLang: String,
  groupName: { type: String, required: true },
  isbn: String,
  lastModified: { type: Number, default: Date.now() },
  published: String,
  publisher: String,
  sha: String,
  sortIndex: { type: Number, default: 0 },
  subtitle: String,
  targetLang: String,
  title: { type: String, required: true },
  type: { type: String, required: true, enum: ['index', 'article', 'dict'] },
});

export type TopicDoc = InferSchemaType<typeof TopicSchema> & { _id?: Types.ObjectId };

const Topic = model('Topic', TopicSchema);

export default Topic;
