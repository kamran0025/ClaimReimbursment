import type { NextFunction, Request, Response } from 'express';

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

/** Wraps an async route handler so a rejected promise reaches Express's error handler. */
export function asyncHandler(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    handler(req, res, next).catch(next);
  };
}
