import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongo: MongoMemoryServer | null = null;

export const connectDB = async () => {
  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();

  await mongoose.connect(uri, {
    dbName: 'taalwiz',
  });
};

export const dropCollections = async () => {
  if (mongo) {
    const collections = await mongoose.connection.db!.collections();
    for (const collection of collections) {
      await mongoose.connection.db!.dropCollection(collection.collectionName);
    }
  }
};

export const closeDB = async () => {
  if (mongo) {
    await mongoose.connection.db!.dropDatabase();
    await mongoose.connection.close();
    await mongo.stop();
    mongo = null;
  }
};
