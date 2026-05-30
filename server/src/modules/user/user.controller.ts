import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as userService from './user.service';

export async function search(req: AuthRequest, res: Response) {
  try {
    const keyword = (req.query.keyword as string) || '';
    const users = await userService.searchUsers(keyword, req.userId!);
    res.json({ code: 200, message: '搜索成功', data: users });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const user = await userService.updateProfile(req.userId!, req.body);
    res.json({ code: 200, message: '更新成功', data: user });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
