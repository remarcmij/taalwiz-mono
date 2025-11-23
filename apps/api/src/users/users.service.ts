import { Injectable } from '@nestjs/common';
import User, { IUser } from './models/user.model.js';

@Injectable()
export class UsersService {
  async findOne(email: string): Promise<IUser | null> {
    return await User.findOne({ email }).exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return await User.findById(id).exec();
  }

  async updateLastAccessed(id: string): Promise<IUser | null> {
    return await User.findByIdAndUpdate(id, { lastAccessed: new Date() }).exec();
  }

  async createUser(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return await user.save();
  }

  async getUsers(): Promise<IUser[]> {
    return await User.find().exec();
  }

  async deleteUserById(id: string): Promise<IUser | null> {
    return await User.findByIdAndDelete(id).exec();
  }

  async inviteNewUser(email: string, lang: string): Promise<IUser> {
    throw new Error('Not implemented yet');
  }
}
