import { Request, Response } from 'express';
import * as notificationService from './notification.service';

export async function list(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const settings = await notificationService.listByUser(userId);
    res.json({ data: settings });
  } catch (err: any) {
    res.status(500).json({ message: err.message || '获取通知设置失败' });
  }
}

export async function upsert(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { conversationId, muted, showPreview } = req.body;

    if (muted !== undefined && typeof muted !== 'boolean') {
      res.status(400).json({ message: 'muted 必须为布尔值' });
      return;
    }
    if (showPreview !== undefined && typeof showPreview !== 'boolean') {
      res.status(400).json({ message: 'showPreview 必须为布尔值' });
      return;
    }

    const setting = await notificationService.upsert(userId, {
      conversationId: conversationId || '',
      muted,
      showPreview,
    });
    res.json({ data: setting });
  } catch (err: any) {
    res.status(500).json({ message: err.message || '更新通知设置失败' });
  }
}

export async function remove(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const { id } = req.params;
    await notificationService.remove(userId, id as string);
    res.json({ data: { success: true } });
  } catch (err: any) {
    res.status(500).json({ message: err.message || '删除通知设置失败' });
  }
}
