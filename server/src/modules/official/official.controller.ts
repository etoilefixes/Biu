import { Request, Response, NextFunction } from 'express';
import * as officialService from './official.service';

export async function getAllUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await officialService.getAllUsers((req as any).userId);
    res.json({ code: 0, data: users });
  } catch (e) {
    next(e);
  }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    await officialService.deleteUser((req as any).userId, req.params.id as string);
    res.json({ code: 0, data: { success: true } });
  } catch (e) {
    next(e);
  }
}

export async function createOfficialChannel(req: Request, res: Response, next: NextFunction) {
  try {
    const channel = await officialService.createOfficialChannel((req as any).userId, req.body);
    res.json({ code: 0, data: channel });
  } catch (e) {
    next(e);
  }
}

export async function sendBroadcast(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await officialService.sendBroadcast((req as any).userId, req.body);
    res.json({ code: 0, data: result });
  } catch (e) {
    next(e);
  }
}

export async function setUserRole(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await officialService.setUserRole(
      (req as any).userId,
      req.params.id as string,
      req.body.role
    );
    res.json({ code: 0, data: user });
  } catch (e) {
    next(e);
  }
}
