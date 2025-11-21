import { model, Schema, Types } from 'mongoose';

export type Role = 'user' | 'admin' | 'demo';
export type Language = 'en' | 'nl';

export interface IUser {
  _id?: Types.ObjectId;
  name?: string;
  email: string;
  password: string;
  roles: Role[];
  lang?: Language;
  created?: Date;
  lastAccessed?: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: false },
  email: { type: String, lowercase: true, required: true, unique: true },
  password: { type: String, required: false },
  roles: { type: [String], default: ['user'] },
  lang: { type: String, default: 'nl' },
  created: { type: Date, default: Date.now },
  lastAccessed: { type: Date, default: Date.now },
});

const User = model<IUser>('User', UserSchema);
export default User;
