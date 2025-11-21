import { model, Schema } from 'mongoose';

export interface IAutoCompletion {
  _id?: string;
  word: string;
  lang: string;
}

const AutoCompletionsSchema = new Schema<IAutoCompletion>(
  {
    word: { type: String, required: true, index: true },
    lang: { type: String, required: true },
  },
  { collation: { locale: 'nl', strength: 1 } },
);

const AutoCompletions = model<IAutoCompletion>('Word', AutoCompletionsSchema);
export default AutoCompletions;
