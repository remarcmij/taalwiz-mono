import mongoose from 'mongoose';

import app from './app.js';
import { seed } from './config/seed.js';
import logger from './util/logger.js';

// docker run -d -p 27017:27017 --name test-mongo mongo:latest
await mongoose.connect(process.env.MONGO_URL!, {
  dbName: 'taalwiz',
});

logger.info('Connected to database');

await seed();

app.listen(3000, () => {
  logger.info('Server is running on port 3000');
});
