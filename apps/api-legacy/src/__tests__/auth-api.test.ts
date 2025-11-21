import assert from 'node:assert/strict';
import { after, afterEach, before, describe, it } from 'node:test';
import request from 'supertest';

import {
  closeDB,
  connectDB,
  dropCollections,
} from '../__test_helpers__/db-mock.js';

import app from '../app.js';
import { createRegistrationToken } from '../controllers/admin.controller.js';
import { encryptPassword } from '../controllers/auth.controller.js';
import User from '../models/user.model.js';

const ADMIN_EMAIL = 'admin@test.com';
const ADMIN_PASSWORD = 'admin_pw';
const TEST_USER_EMAIL = 'user@test.com';
const TEST_USER_PASSWORD = 'user_pw';

async function seedUsers() {
  const adminUser = new User({
    email: ADMIN_EMAIL,
    password: await encryptPassword(ADMIN_PASSWORD),
    name: 'Administrator',
    lang: 'en',
    role: 'admin',
  });
  await adminUser.save();

  const testUser = new User({
    email: TEST_USER_EMAIL,
    password: await encryptPassword(TEST_USER_PASSWORD),
    name: 'Test User',
    lang: 'en',
    role: 'user',
  });
  await testUser.save();
}

before(async () => {
  await connectDB();
});

after(async () => {
  await closeDB();
});

afterEach(async () => {
  await dropCollections();
});

describe('/auth-api/registration', () => {
  it('should successfully register a new user', async () => {
    const email = 'newuser@test.com';
    const lang = 'en';

    const token = createRegistrationToken(email, lang);

    const resp = await request(app)
      .post('/auth-api/register')
      .send({
        email,
        password: '123456',
        name: 'test',
        token,
      })
      .set('Accept', 'application/json')
      .expect(200);

    assert.equal(resp.body.email, email);
    assert.equal(resp.body.name, 'test');
    assert.equal(resp.body.role, 'user');
    assert.equal(resp.body.lang, lang);
    assert.ok(resp.body.id);
    assert.ok(resp.body.refreshToken);
    assert.equal(typeof resp.body.refreshExp, 'number');
  });

  it('should reject registration as an existing user', async () => {
    const email = 'user@test.com';
    const lang = 'en';

    await seedUsers();

    const token = createRegistrationToken(email, lang);

    const resp = await request(app)
      .post('/auth-api/register')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        name: 'test',
        token,
      })
      .set('Accept', 'application/json')
      .expect(400);

    assert.equal(resp.body.message, 'EMAIL_EXISTS');
  });
});

describe('/auth-api/login', () => {
  it('should successfully login an existing user with correct password', async () => {
    await seedUsers();

    const resp = await request(app)
      .post('/auth-api/login')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
      })
      .set('Accept', 'application/json')
      .expect(200);

    assert.equal(resp.body.email, TEST_USER_EMAIL);
    assert.equal(resp.body.name, 'Test User');
    assert.equal(resp.body.role, 'user');
    assert.equal(resp.body.lang, 'en');
    assert.ok(resp.body.id);
    assert.ok(resp.body.refreshToken);
    assert.equal(typeof resp.body.refreshExp, 'number');
  });

  it('should reject login with incorrect password', async () => {
    await seedUsers();

    const resp = await request(app)
      .post('/auth-api/login')
      .send({
        email: TEST_USER_EMAIL,
        password: 'wrong_password',
      })
      .set('Accept', 'application/json')
      .expect(401);

    assert.equal(resp.body.message, 'AUTH_FAILED');
  });

  it('should reject login with non-existing email', async () => {
    await seedUsers();

    const resp = await request(app)
      .post('/auth-api/login')
      .send({
        email: 'nobody@test.com',
        password: 'whatever',
      })
      .set('Accept', 'application/json')
      .expect(401);

    assert.equal(resp.body.message, 'AUTH_FAILED');
  });
});

describe('/auth-api/change-password', () => {
  it('should successfully change password using valid credentials', async () => {
    await seedUsers();

    await request(app)
      .post('/auth-api/change-password')
      .send({
        email: TEST_USER_EMAIL,
        password: TEST_USER_PASSWORD,
        newPassword: 'new_password',
      })
      .expect(200);
  });

  it('should reject changing password with invalid old password', async () => {
    await seedUsers();

    const resp = await request(app)
      .post('/auth-api/change-password')
      .send({
        email: TEST_USER_EMAIL,
        password: 'wrong_password',
        newPassword: 'new_password',
      })
      .expect(401);

    assert.equal(resp.body.message, 'AUTH_FAILED');
  });

  it('should reject changing password with non-existing email', async () => {
    await seedUsers();

    const resp = await request(app)
      .post('/auth-api/change-password')
      .send({
        email: 'nobody@test.com',
        password: 'whatever',
        newPassword: 'new_password',
      })
      .expect(400);

    assert.equal(resp.body.message, 'AUTH_FAILED');
  });
});
