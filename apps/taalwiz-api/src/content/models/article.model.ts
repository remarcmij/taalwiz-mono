import { InferSchemaType, model, Schema, Types } from 'mongoose';
import { ExtractedHashtag } from './hashtag.model.js';

const ArticleSchema = new Schema({
  _topic: { type: Schema.Types.ObjectId, index: true, ref: 'Topic' },
  baseLang: { type: String },
  filename: { type: String, required: true, index: true },
  foreignLang: { type: String },
  groupName: { type: String, required: true },
  htmlText: { type: String, required: true },
  mdText: { type: String, required: true },
  title: { type: String, required: true },
});

export type ArticleDoc = InferSchemaType<typeof ArticleSchema> & {
  _id?: Types.ObjectId;
  hashtags: ExtractedHashtag[];
};

ArticleSchema.index({ indexText: 'text' }, { default_language: 'none' });

const Article = model('Article', ArticleSchema);
export default Article;
