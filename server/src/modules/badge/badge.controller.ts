import { Request, Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as badgeService from './badge.service';

export async function listBadges(_req: Request, res: Response) {
  const badges = await badgeService.listBadges();
  res.json({ code: 200, data: badges });
}

export async function getUserBadges(req: Request, res: Response) {
  const userId = req.params.userId as string;
  const badges = await badgeService.getUserBadges(userId);
  res.json({ code: 200, data: badges });
}

export async function assignBadge(req: AuthRequest, res: Response) {
  const { userId, badgeType } = req.body;
  try {
    const result = await badgeService.assignBadge(req.userId!, userId, badgeType);
    res.json({ code: 200, data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
