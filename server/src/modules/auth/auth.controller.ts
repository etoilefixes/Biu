import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as authService from './auth.service';
import { RegisterError } from './auth.service';

export async function register(req: Request, res: Response) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ code: 201, message: '注册成功', data: result });
  } catch (err: any) {
    // RegisterError 携带 statusCode，可区分不同错误类型
    if (err instanceof RegisterError) {
      return res.status(err.statusCode).json({ code: err.statusCode, message: err.message });
    }
    // Prisma 唯一约束冲突（兜底）
    if (err.code === 'P2002') {
      const target = err.meta?.target;
      if (target?.includes('username')) {
        return res.status(409).json({ code: 409, message: '用户名已存在' });
      }
      if (target?.includes('biuId')) {
        return res.status(500).json({ code: 500, message: '注册失败，请稍后重试' });
      }
    }
    // 未知错误：不暴露内部细节
    console.error('Register error:', err);
    res.status(500).json({ code: 500, message: '注册失败，请稍后重试' });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.login(req.body);
    res.json({ code: 200, message: '登录成功', data: result });
  } catch (err: any) {
    res.status(401).json({ code: 401, message: err.message });
  }
}

export async function me(req: AuthRequest, res: Response) {
  try {
    const user = await authService.getMe(req.userId!);
    res.json({ code: 200, message: '获取成功', data: user });
  } catch (err: any) {
    res.status(404).json({ code: 404, message: err.message });
  }
}
