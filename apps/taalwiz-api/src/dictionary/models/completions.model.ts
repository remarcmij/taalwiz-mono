import { InferSchemaType, model, Schema, Types } from 'mongoose';

const AutoCompletionSchema = new Schema(
  {
    word: { type: String, required: true, index: true },
    lang: { type: String, required: true },
  },
  { collation: { locale: 'nl', strength: 1 } },
);

export type AutoCompletionDoc = InferSchemaType<typeof AutoCompletionSchema> & {
  _id?: Types.ObjectId;
};

const AutoCompletions = model('Word', AutoCompletionSchema);
export default AutoCompletions;
