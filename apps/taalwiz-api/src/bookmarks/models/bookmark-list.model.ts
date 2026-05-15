import { InferSchemaType, model, Schema, Types } from 'mongoose';

const BookmarkListSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

BookmarkListSchema.index({ userId: 1, name: 1 }, { unique: true });

export type BookmarkListDoc = InferSchemaType<typeof BookmarkListSchema> & {
  _id: Types.ObjectId;
};

const BookmarkList = model('BookmarkList', BookmarkListSchema);
export default BookmarkList;
