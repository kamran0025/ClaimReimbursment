import type { NextFunction, Request, Response } from 'express';
import type { ZodSchema } from 'zod';

/** Parses+replaces `req.body` with the schema's output. A thrown `ZodError` is caught by `errorHandler`. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.body = schema.parse(req.body);
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.query = schema.parse(req.query) as unknown as Request['query'];
    next();
  };
}
