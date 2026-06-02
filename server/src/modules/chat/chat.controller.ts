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
    const id = req.params.id as string;
    const conversation = await chatService.getConversationDetail(id, req.userId!);
    res.json({ code: 200, message: '获取成功', data: conversation });
  } catch (err: any) {
    res.status(403).json({ code: 403, message: err.message });
  }
}

export async function markRead(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    await chatService.markAsRead(req.userId!, id);
    res.json({ code: 200, message: '标记成功' });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function markAllRead(req: AuthRequest, res: Response) {
  try {
    await chatService.markAllAsRead(req.userId!);
    res.json({ code: 200, message: '全部标记成功' });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    await chatService.deleteConversation(req.userId!, id);
    res.json({ code: 200, message: '删除成功' });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function addMember(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { memberUserId } = req.body;
    const member = await chatService.addMemberToConversation(req.userId!, id, memberUserId);
    res.json({ code: 200, message: '添加成功', data: member });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function updateName(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { name } = req.body;
    const conversation = await chatService.updateGroupName(req.userId!, id, name);
    res.json({ code: 200, message: '更新成功', data: conversation });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function updateNickname(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { nickname } = req.body;
    const member = await chatService.updateMemberNickname(req.userId!, id, nickname);
    res.json({ code: 200, message: '更新成功', data: member });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function setAnnouncement(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { announcement } = req.body;
    const conversation = await chatService.setAnnouncement(req.userId!, id, announcement);
    res.json({ code: 200, message: '设置成功', data: conversation });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function removeMember(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const { memberId } = req.body;
    await chatService.removeMember(req.userId!, id, memberId);
    res.json({ code: 200, message: '移除成功' });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function leaveGroup(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const result = await chatService.leaveGroup(req.userId!, id);
    res.json({ code: 200, message: result.deleted ? '群聊已解散' : '已退出群聊', data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function dissolveGroup(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    await chatService.dissolveGroup(req.userId!, id);
    res.json({ code: 200, message: '群聊已解散' });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
