import type { JwtPayload } from './jwtpayload.interface.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
