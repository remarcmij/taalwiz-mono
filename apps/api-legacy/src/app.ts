import 'dotenv/config';

import compression from 'compression';
import express, { ErrorRequestHandler, RequestHandler } from 'express';
import { expressjwt } from 'express-jwt';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';

import apiRouter from './routes/api.router.js';
import authRouter from './routes/auth.router.js';
import logger from './util/logger.js';

const authGuard: RequestHandler = expressjwt({
  secret: process.env.JWT_SECRET!,
  algorithms: ['HS256'],
}) as unknown as RequestHandler;

const jwtErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ message: err.message });
    logger.error(err.message);
    return;
  }
  next(err);
};

const app = express();

if (!['production', 'test'].includes(process.env.NODE_ENV!)) {
  app.use(morgan('tiny'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

app.use('/auth-api', authRouter);
app.use('/api', authGuard, apiRouter);

app.get('/hello', (_req, res) => {
  res.json({ message: 'Hello world' });
});

app.use(jwtErrorHandler);

app.use(express.static('public'));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendPath = path.normalize(
  path.join(__dirname, '../../taalwiz/www/browser')
);

// Serve the client
// if (process.env.NODE_ENV === 'production') {
app.use(express.static(path.normalize(frontendPath)));
// Redirect * requests to give the client data
app.get('*other', (_req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});
// }

export default app;
