import { InferSchemaType, model, Schema, Types } from 'mongoose';

export type Role = 'user' | 'admin' | 'demo';
export type Language = 'en' | 'nl';

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, lowercase: true, required: true, unique: true },
  password: { type: String, required: true },
  roles: { type: [String], default: ['user'], enum: ['user', 'admin', 'demo'] },
  lang: { type: String, default: 'nl' },
  created: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
});

export type UserDoc = InferSchemaType<typeof UserSchema> & {
  _id?: Types.ObjectId;
};

const User = model('User', UserSchema);
export default User;
