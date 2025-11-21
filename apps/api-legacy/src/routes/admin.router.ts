import express from 'express';
import multer from 'multer';

import {
  deleteUser,
  getSettings,
  getUser,
  getUsers,
  inviteNewUser,
  inviteNewUserValidations,
  updateSettings,
  updateSettingsValidations,
  userIdValidations,
} from '../controllers/admin.controller.js';
import {
  removeTopic,
  removeTopicValidations,
  updateSortIndices,
  updateSortIndicesValidations,
  uploadTopic,
} from '../controllers/content.controller.js';
import { validate } from '../util/validate.js';

const uploadSingleFile = multer().single('file');

const router = express
  .Router()
  .get('/users', getUsers)
  .get('/users/:id', userIdValidations(), validate, getUser)
  .delete('/users/:id', userIdValidations(), validate, deleteUser)
  .post('/upload', uploadSingleFile, uploadTopic)
  .delete('/topics/:filename', removeTopicValidations(), validate, removeTopic)
  .patch(
    '/sort-indices',
    updateSortIndicesValidations(),
    validate,
    updateSortIndices
  )
  .get(
    '/users/invite/:email/:lang',
    inviteNewUserValidations(),
    validate,
    inviteNewUser
  )
  .get('/settings', getSettings)
  .patch('/settings', updateSettingsValidations(), validate, updateSettings);

export default router;
