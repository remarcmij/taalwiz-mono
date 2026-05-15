import { InferSchemaType, model, Schema, Types } from 'mongoose';

const BookmarkSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  listId: { type: Schema.Types.ObjectId, required: true, ref: 'BookmarkList' },
  word: { type: String, required: true },
  lang: { type: String, required: true },
  savedAt: { type: Date, default: Date.now },
});

BookmarkSchema.index({ userId: 1, listId: 1, word: 1, lang: 1 }, { unique: true });

export type BookmarkDoc = InferSchemaType<typeof BookmarkSchema> & {
  _id?: Types.ObjectId;
};

const Bookmark = model('Bookmark', BookmarkSchema);
export default Bookmark;
