import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import { idParam } from '../validators';

export async function list(req: Request, res: Response) {
  res.json(await notificationService.listNotifications(req.user!.id));
}

export async function markRead(req: Request, res: Response) {
  res.json(await notificationService.markRead(req.user!.id, idParam.parse(req.params).id));
}

export async function markAllRead(req: Request, res: Response) {
  res.json(await notificationService.markAllRead(req.user!.id));
}
