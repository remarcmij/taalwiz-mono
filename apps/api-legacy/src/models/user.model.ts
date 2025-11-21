import { model, Schema, Types } from 'mongoose';

export interface IUser extends Express.User {
  _id?: Types.ObjectId;
  name?: string;
  email: string;
  password: string;
  role: roleType;
  lang?: 'en' | 'nl';
  created?: Date;
  lastAccessed?: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: false },
  email: { type: String, lowercase: true, required: true, unique: true },
  password: { type: String, required: false },
  role: { type: String, default: 'user' },
  lang: { type: String, default: 'nl' },
  created: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
});

const User = model<IUser>('User', UserSchema);
export default User;
