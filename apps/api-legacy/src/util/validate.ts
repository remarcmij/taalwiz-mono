import { RequestHandler } from 'express';
import { ValidationError, validationResult } from 'express-validator';

// Adapted from: https://dev.to/nedsoft/a-clean-approach-to-using-express-validator-8go
export const validate: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  const extractedErrors: Record<string, string>[] = [];
  errors.array().map((err: ValidationError) => {
    switch (err.type) {
      case 'field':
        extractedErrors.push({ [err.path]: err.msg });
    }
  });

  return res.status(422).json({
    errors: extractedErrors,
  });
};
