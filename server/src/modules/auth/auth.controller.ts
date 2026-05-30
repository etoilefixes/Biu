import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as authService from './auth.service';

export async function register(req: Request, res: Response) {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ code: 201, message: '注册成功', data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
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
