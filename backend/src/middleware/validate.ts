import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const validate =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      // Only write back what the schema actually declared. Zod strips keys it
      // was not told about, so a body-only schema parses to `{ body }` — and
      // assigning `result.params` unconditionally wiped req.params to undefined,
      // breaking every route that pairs a body-only schema with a route param
      // (assignment submit, grade, and anything else shaped that way).
      if (result.body !== undefined) req.body = result.body;
      if (result.query !== undefined) req.query = result.query as typeof req.query;
      if (result.params !== undefined) req.params = result.params as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, 'Validation failed', error.flatten().fieldErrors);
      }
      throw error;
    }
  };
