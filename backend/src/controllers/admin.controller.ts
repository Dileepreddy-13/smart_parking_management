import type { Request, Response } from 'express';
import { z } from 'zod';
import * as adminService from '../services/admin.service';
import * as notificationService from '../services/notification.service';
import { occupancy } from '../services/parking.service';
import * as paymentService from '../services/payment.service';
import * as reservationService from '../services/reservation.service';
import { listAllSlots } from '../services/slot.service';
import {
  adminPaymentQuery,
  adminReservationQuery,
  adminUserQuery,
  broadcastSchema,
  cancelSchema,
  daysQuery,
  idParam,
  userStatusSchema,
} from '../validators';

const id = (req: Request) => idParam.parse(req.params).id;

export async function dashboard(_req: Request, res: Response) {
  res.json(await adminService.dashboard());
}

export async function getOccupancy(_req: Request, res: Response) {
  res.json(await occupancy());
}

export async function revenue(req: Request, res: Response) {
  res.json(await adminService.revenue(daysQuery.parse(req.query).days));
}

export async function users(req: Request, res: Response) {
  res.json(await adminService.listUsers(adminUserQuery.parse(req.query)));
}

export async function user(req: Request, res: Response) {
  res.json(await adminService.getUser(id(req)));
}

export async function setUserStatus(req: Request, res: Response) {
  res.json(await adminService.setUserStatus(id(req), userStatusSchema.parse(req.body).status, req.user!.id));
}

export async function reservations(req: Request, res: Response) {
  res.json(await reservationService.listForAdmin(adminReservationQuery.parse(req.query)));
}

export async function cancelReservation(req: Request, res: Response) {
  res.json(await reservationService.cancelReservation(id(req), req.user!, cancelSchema.parse(req.body ?? {}).reason));
}

export async function payments(req: Request, res: Response) {
  res.json(await paymentService.listForAdmin(adminPaymentQuery.parse(req.query)));
}

export async function slots(req: Request, res: Response) {
  res.json(await listAllSlots(z.object({ areaId: z.uuid().optional() }).parse(req.query).areaId));
}

export async function notifications(_req: Request, res: Response) {
  res.json(await notificationService.recentNotifications());
}

export async function broadcast(req: Request, res: Response) {
  const body = broadcastSchema.parse(req.body);
  res.status(201).json(await notificationService.broadcast(body.title, body.message, body.userId));
}
