import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as messageService from './message.service';

export async function list(req: AuthRequest, res: Response) {
  try {
    const before = req.query.before as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const conversationId = req.params.conversationId as string;
    const messages = await messageService.getMessages(
      conversationId,
      req.userId!,
      before,
      limit
    );
    res.json({ code: 200, message: '获取成功', data: messages });
  } catch (err: any) {
    res.status(403).json({ code: 403, message: err.message });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const conversationId = req.params.conversationId as string;
    const message = await messageService.createMessage(
      conversationId,
      req.userId!,
      req.body.content,
      req.body.type,
      req.body.cardType || null,
      req.body.cardData || null
    );
    res.status(201).json({ code: 201, message: '发送成功', data: message });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
