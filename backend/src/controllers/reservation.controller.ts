import type { Request, Response } from 'express';
import * as paymentService from '../services/payment.service';
import * as reservationService from '../services/reservation.service';
import { cancelSchema, createOrderSchema, idParam, reservationQuery, reservationSchema, verifyPaymentSchema } from '../validators';

const id = (req: Request) => idParam.parse(req.params).id;

export async function quote(req: Request, res: Response) {
  res.json(await reservationService.quote(req.user!.id, reservationSchema.parse(req.body)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await reservationService.createReservation(req.user!.id, reservationSchema.parse(req.body)));
}

export async function list(req: Request, res: Response) {
  res.json(await reservationService.listForUser(req.user!.id, reservationQuery.parse(req.query)));
}

export async function get(req: Request, res: Response) {
  res.json(await reservationService.getReservation(id(req), req.user!));
}

export async function cancel(req: Request, res: Response) {
  // Customers always cancel under the customer policy; the admin override lives under /api/admin.
  const actor = { id: req.user!.id, role: 'USER' as const };
  res.json(await reservationService.cancelReservation(id(req), actor, cancelSchema.parse(req.body ?? {}).reason));
}

export async function createOrder(req: Request, res: Response) {
  res.status(201).json(await paymentService.createOrder(createOrderSchema.parse(req.body).reservationId, req.user!.id));
}

export async function verifyPayment(req: Request, res: Response) {
  res.json(await paymentService.verifyPayment(verifyPaymentSchema.parse(req.body), req.user!.id));
}

export async function listPayments(req: Request, res: Response) {
  res.json(await paymentService.listForUser(req.user!.id));
}

export async function getPayment(req: Request, res: Response) {
  res.json(await paymentService.getPayment(id(req), req.user!));
}
