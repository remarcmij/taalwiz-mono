import express from 'express';
import {
  validateRegToken,
  validateRegTokenValidations,
} from '../controllers/admin.controller.js';
import {
  changePassword,
  changePasswordValidations,
  login,
  loginValidations,
  refreshAccessToken,
  refreshAccessTokenValidations,
  register,
  registerValidations,
  requestPasswordReset,
  requestPasswordResetValidations,
  resetPassword,
  resetPasswordValidations,
} from '../controllers/auth.controller.js';
import { validate } from '../util/validate.js';

const router = express.Router();

router
  .post('/login', loginValidations(), validate, login)
  .post('/register', registerValidations(), validate, register)
  .get(
    '/validate-regtoken',
    validateRegTokenValidations(),
    validate,
    validateRegToken
  )
  .post(
    '/change-password',
    changePasswordValidations(),
    validate,
    changePassword
  )
  .post(
    '/request-password-reset',
    requestPasswordResetValidations(),
    validate,
    requestPasswordReset
  )
  .post('/reset-password', resetPasswordValidations(), validate, resetPassword)
  .post(
    '/token',
    refreshAccessTokenValidations(),
    validate,
    refreshAccessToken
  );

export default router;
