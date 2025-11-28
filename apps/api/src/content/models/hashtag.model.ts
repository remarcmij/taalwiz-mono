import { InferSchemaType, model, Schema, Types } from 'mongoose';

export type ExtractedHashtag = {
  tagname: string;
  id: string;
  publicationTitle: string;
  articleTitle: string;
  sectionHeader: string;
};

const HashtagSchema = new Schema({
  name: { type: String, required: true, index: true },
  id: { type: String, required: true },
  publicationTitle: { type: String, required: true },
  sectionHeader: { type: String, required: true },
  groupName: { type: String, required: true },
  _topic: { type: Schema.Types.ObjectId, index: true, ref: 'Topic' },
});

export type HashtagDoc = InferSchemaType<typeof HashtagSchema> & { _id?: Types.ObjectId };

const Hashtag = model('Hashtag', HashtagSchema);
export default Hashtag;
