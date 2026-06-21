import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ZodError } from 'zod';

/**
 * 统一错误处理中间件
 *
 * 安全要点：
 * - 不向客户端泄漏 err.message（可能含 Prisma SQL/表结构/字段名/文件路径）
 * - 区分错误类型返回合适状态码
 * - 业务错误（携带 statusCode）透传 message
 * - Prisma 已知错误按 code 映射状态码
 * - ZodError 返回 422
 * - 兜底 500 只返回通用提示，details 仅在非生产环境暴露
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('Error:', err);

  // 1. ZodError — 输入校验失败
  if (err instanceof ZodError) {
    return res.status(422).json({
      code: 422,
      message: '输入校验失败',
      details: err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', '),
    });
  }

  // 2. 业务错误（携带 statusCode，如 RegisterError）
  const anyErr = err as Error & { statusCode?: number };
  if (typeof anyErr.statusCode === 'number' && anyErr.statusCode >= 400 && anyErr.statusCode < 600) {
    return res.status(anyErr.statusCode).json({
      code: anyErr.statusCode,
      message: err.message,
    });
  }

  // 3. Prisma 已知错误 — 按 code 映射状态码，不泄漏内部细节
  if (err instanceof PrismaClientKnownRequestError) {
    let status = 500;
    let message = '数据库操作失败';
    switch (err.code) {
      case 'P2002': // 唯一约束冲突
        status = 409;
        message = '资源已存在，唯一约束冲突';
        break;
      case 'P2025': // 记录不存在
        status = 404;
        message = '资源不存在';
        break;
      case 'P2003': // 外键约束冲突
        status = 400;
        message = '关联资源不存在';
        break;
      default:
        break;
    }
    return res.status(status).json({ code: status, message });
  }

  // 4. 兜底 500 — 不泄漏 err.message
  const isProduction = process.env.NODE_ENV === 'production';
  const body: { code: number; message: string; details?: string } = {
    code: 500,
    message: '服务器内部错误',
  };
  // 仅在非生产环境暴露错误细节，便于开发调试
  if (!isProduction) {
    body.details = err.message;
  }
  return res.status(500).json(body);
}
