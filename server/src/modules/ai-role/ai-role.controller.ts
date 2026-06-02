import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import * as aiRoleService from './ai-role.service';

export async function listRoles(req: AuthRequest, res: Response) {
  try {
    const roles = await aiRoleService.listRoles(req.userId!);
    res.json({ code: 200, message: '获取成功', data: roles });
  } catch (err: any) {
    res.status(500).json({ code: 500, message: err.message });
  }
}

export async function getRole(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;
    const role = await aiRoleService.getRole(id, req.userId!);
    res.json({ code: 200, message: '获取成功', data: role });
  } catch (err: any) {
    res.status(403).json({ code: 403, message: err.message });
  }
}

export async function createRole(req: AuthRequest, res: Response) {
  try {
    const role = await aiRoleService.createRole(req.userId!, req.body);
    res.status(201).json({ code: 201, message: '创建成功', data: role });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function updateRole(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;
    const role = await aiRoleService.updateRole(id, req.userId!, req.body);
    res.json({ code: 200, message: '更新成功', data: role });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function deleteRole(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;
    await aiRoleService.deleteRole(id, req.userId!);
    res.json({ code: 200, message: '删除成功' });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}

export async function chatWithRole(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id;
    const result = await aiRoleService.chatWithRole(id, req.userId!);
    res.json({ code: 200, message: '获取成功', data: result });
  } catch (err: any) {
    res.status(400).json({ code: 400, message: err.message });
  }
}
