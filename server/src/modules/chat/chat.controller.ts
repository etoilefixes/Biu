import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as chatService from './chat.service';

export async function list(req: AuthRequest, res: Response) {
  try {
    const conversations = await chatService.getConversations(req.userId!);
    res.json({ code: 200, message: '获取成功', data: conversations });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const conversation = await chatService.createConversation(req.userId!, req.body);
    res.status(201).json({ code: 201, message: '创建成功', data: conversation });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function detail(req: AuthRequest, res: Response) {
  try {
    const conversation = await chatService.getConversationDetail(req.params.id, req.userId!);
    res.json({ code: 200, message: '获取成功', data: conversation });
  } catch (err: any) {
    res.status(403).json({ code: 403, message: err.message });
  }
}

export async function markRead(req: AuthRequest, res: Response) {
  try {
    await chatService.markAsRead(req.userId!, req.params.id);
    res.json({ code: 200, message: '标记成功' });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
