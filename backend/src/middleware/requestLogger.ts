import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger';

// One line per request once the response is sent: method, path, status,
// duration, and the error code if errorHandler set one.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const errorCode = res.locals.errorCode ? ` ${res.locals.errorCode}` : '';
    const line = `${req.method} ${req.originalUrl.split('?')[0]} ${res.statusCode} ${Date.now() - start}ms${errorCode}`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });
  next();
}
