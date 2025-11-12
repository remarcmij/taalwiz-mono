import { model, Schema, Types } from 'mongoose';

export interface ILemma extends Document {
  _id: Types.ObjectId;
  word: string;
  lang: string;
  attr: string;
  baseWord: string;
  baseLang: string;
  text: string;
  order: number;
  homonym: number;
  groupName: string;
  _lemma?: Types.ObjectId;
  _topic?: Types.ObjectId;
}

const LemmaSchema = new Schema<ILemma>(
  {
    word: { type: String, required: true },
    lang: { type: String, required: true },
    baseWord: { type: String, required: true },
    baseLang: { type: String, required: true },
    order: { type: Number, required: true },
    homonym: { type: Number, required: true },
    attr: { type: String, required: true },
    text: { type: String, required: true },
    groupName: { type: String, required: true },
    _topic: { type: Schema.Types.ObjectId, required: true, ref: 'Topic' },
  },
  { collation: { locale: 'nl', strength: 1 } }
);

LemmaSchema.index({ word: 1, lang: 1, order: 1 });

const Lemma = model<ILemma>('Lemma', LemmaSchema);
export default Lemma;
