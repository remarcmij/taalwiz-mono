import { model, Schema, Types } from 'mongoose';

export interface ITopic {
  _id?: Types.ObjectId;
  author?: string;
  baseLang?: string;
  copyright?: string;
  filename: string;
  foreignLang?: string;
  groupName: string;
  isbn?: string;
  lastModified?: number;
  published?: string;
  publisher?: string;
  sha?: string;
  sortIndex?: number;
  subtitle?: string;
  targetLang?: string;
  title: string;
  type: 'index' | 'article' | 'dict';
}

const TopicSchema = new Schema<ITopic>({
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
  title: String,
  type: { type: String, required: true, enum: ['index', 'article', 'dict'] },
});

const Topic = model('Topic', TopicSchema);
export default Topic;
