import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateRefreshToken } from '../controllers/auth.controller.js';

const testUser = {
  id: 1,
  email: 'user@test.com',
  password: 'password',
  role: 'user' as roleType,
};

describe('auth', () => {
  describe('token generation', () => {
    it('should generate a refresh token', () => {
      const refreshToken = generateRefreshToken(testUser);
      assert.ok(refreshToken.token);
      assert.ok(refreshToken.exp);
    });

    it('should return an access token, given a refresh token', () => {
      const refreshToken = generateRefreshToken(testUser);
      assert.ok(refreshToken.token);
      assert.ok(refreshToken.exp);
    });
  });
});
