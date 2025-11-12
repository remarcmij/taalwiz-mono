import { Model, model, Schema, Types } from 'mongoose';
import { ExtractedHashtag } from './hashtag.model.js';

export interface IArticle {
  _topic?: Types.ObjectId;
  baseLang: string;
  filename: string;
  foreignLang: string;
  groupName: string;
  htmlText: string;
  mdText: string;
  title: string;
  //Not used in the mongoose model:
  hashtags: ExtractedHashtag[];
}

const ArticleSchema = new Schema<IArticle>({
  _topic: { type: Schema.Types.ObjectId, index: true, ref: 'Topic' },
  baseLang: { type: String },
  filename: { type: String, required: true, index: true },
  foreignLang: { type: String },
  groupName: { type: String, required: true },
  htmlText: { type: String, required: true },
  mdText: { type: String, required: true },
  title: { type: String, required: true },
});

ArticleSchema.index({ indexText: 'text' }, { default_language: 'none' });

const Article: Model<IArticle> = model<IArticle>('Article', ArticleSchema);
export default Article;
