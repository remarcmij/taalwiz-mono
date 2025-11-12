import { model, Schema } from 'mongoose';

export interface ISuggestion {
  word: string;
  lang: string;
}

const SuggestionSchema = new Schema<ISuggestion>(
  {
    word: { type: String, required: true, index: true },
    lang: { type: String, required: true },
  },
  { collation: { locale: 'nl', strength: 1 } }
);

const Suggestion = model<ISuggestion>('Word', SuggestionSchema);
export default Suggestion;
