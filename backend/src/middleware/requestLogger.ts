import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

const HIDDEN_FIELDS = ['password'];
const MAX_PAYLOAD_LENGTH = 200;

// Request body/query as short JSON: sensitive fields masked, long bodies cut off.
// Empty for bodiless requests (GET/DELETE). Uploaded files never appear —
// multer keeps them in req.file, not req.body.
function formatPayload(body: unknown): string {
  if (!body || typeof body !== 'object' || Object.keys(body).length === 0) return '';
  const json = JSON.stringify(body, (key, value) => (HIDDEN_FIELDS.includes(key) ? '***' : value));
  return ` ${json.length > MAX_PAYLOAD_LENGTH ? `${json.slice(0, MAX_PAYLOAD_LENGTH)}...` : json}`;
}

// One line per request once the response is sent: method, path, status,
// duration, the error code if errorHandler set one, the query and the payload.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const errorCode = res.locals.errorCode ? ` ${res.locals.errorCode}` : '';
    const query = formatPayload(req.query);
    const body = formatPayload(req.body);
    const line = `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - start}ms${errorCode}${query && ` query=${query.trim()}`}${body && ` body=${body.trim()}`}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });
  next();
}
