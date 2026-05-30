import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        return res.status(422).json({
          code: 422,
          message: '输入校验失败',
          details: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
        });
      }
      next(err);
    }
  };
}
