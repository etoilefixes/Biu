import { Request, Response, NextFunction } from 'express';
import * as aiService from './ai.service';

export async function quickSend(req: Request, res: Response, next: NextFunction) {
  try {
    const { targetUserId, content } = req.body;
    const message = await aiService.quickSendMessage(
      (req as any).userId,
      targetUserId,
      content
    );
    res.json({ code: 0, data: message });
  } catch (e) {
    next(e);
  }
}

export async function getRecent(req: Request, res: Response, next: NextFunction) {
  try {
    const limit = Number(req.query.limit) || 10;
    const conversations = await aiService.getRecentConversations(
      (req as any).userId,
      limit
    );
    res.json({ code: 0, data: conversations });
  } catch (e) {
    next(e);
  }
}

export async function findUser(req: Request, res: Response, next: NextFunction) {
  try {
    const biuId = req.params.biuId as string;
    const user = await aiService.findUserByBiuId(biuId);
    res.json({ code: 0, data: user });
  } catch (e) {
    next(e);
  }
}
