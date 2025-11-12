import { model, Schema, Types } from 'mongoose';

export type ExtractedHashtag = {
  tagname: string;
  id: string;
  publicationTitle: string;
  articleTitle: string;
  sectionHeader: string;
};

export interface IHashtag {
  name: string;
  id: string;
  publicationTitle: string;
  sectionHeader: string;
  groupName: string;
  _topic?: Types.ObjectId; // reference to Article topic
}

const HashtagSchema = new Schema<IHashtag>({
  name: { type: String, required: true, index: true },
  id: { type: String, required: true },
  publicationTitle: { type: String, required: true },
  sectionHeader: { type: String, required: true },
  groupName: { type: String, required: true },
  _topic: { type: Schema.Types.ObjectId, index: true, ref: 'Topic' },
});

const Hashtag = model('Hashtag', HashtagSchema);
export default Hashtag;
