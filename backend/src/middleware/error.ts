import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { isTest } from '../config/env';
import { AppError } from '../utils/errors';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
};

/** Converts every error into a consistent JSON shape. Stack traces never leave the server. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    const first = details[0];
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: first ? `${first.field ? `${first.field}: ` : ''}${first.message}` : 'Invalid input.',
        details,
      },
    });
    return;
  }
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Request body is not valid JSON.' } });
    return;
  }
  // PostgreSQL "invalid text representation" (e.g. a malformed UUID in the URL)
  const pgCode = err?.code ?? err?.cause?.code;
  if (pgCode === '22P02') {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid identifier.' } });
    return;
  }
  if (!isTest) console.error('[error]', err);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } });
};
