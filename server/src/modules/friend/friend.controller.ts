import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as friendService from './friend.service';

export async function sendRequest(req: AuthRequest, res: Response) {
  try {
    const result = await friendService.sendFriendRequest(
      req.userId!,
      req.body.toUserId,
      req.body.message
    );
    res.status(201).json({ code: 201, message: '请求已发送', data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function handleRequest(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const result = await friendService.handleFriendRequest(
      req.userId!,
      id,
      req.body.action
    );
    res.json({ code: 200, message: '处理成功', data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function listRequests(req: AuthRequest, res: Response) {
  try {
    const result = await friendService.getFriendRequests(req.userId!);
    res.json({ code: 200, message: '获取成功', data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

export async function listFriends(req: AuthRequest, res: Response) {
  try {
    const result = await friendService.getFriends(req.userId!);
    res.json({ code: 200, message: '获取成功', data: result });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

export async function deleteFriend(req: AuthRequest, res: Response) {
  try {
    const friendId = req.params.friendId as string;
    const result = await friendService.deleteFriend(req.userId!, friendId);
    res.json({ code: 200, message: '删除成功', data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
