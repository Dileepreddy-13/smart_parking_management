import type { Request, Response } from 'express';
import { z } from 'zod';
import * as parkingService from '../services/parking.service';
import * as slotService from '../services/slot.service';
import {
  areaQuery,
  areaSchema,
  areaUpdateSchema,
  hoursBody,
  idParam,
  ratesBody,
  slotQuery,
  slotSchema,
  slotStatusSchema,
  slotUpdateSchema,
} from '../validators';

const isAdmin = (req: Request) => req.user?.role === 'ADMIN';
const id = (req: Request) => idParam.parse(req.params).id;
const coords = z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() });

export async function list(req: Request, res: Response) {
  res.json(await parkingService.listAreas(areaQuery.parse(req.query), isAdmin(req)));
}

export async function get(req: Request, res: Response) {
  res.json(await parkingService.getArea(id(req), { isAdmin: isAdmin(req), ...coords.parse(req.query) }));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(await parkingService.createArea(areaSchema.parse(req.body)));
}

export async function update(req: Request, res: Response) {
  res.json(await parkingService.updateArea(id(req), areaUpdateSchema.parse(req.body)));
}

export async function deactivate(req: Request, res: Response) {
  res.json(await parkingService.deactivateArea(id(req)));
}

export async function setRates(req: Request, res: Response) {
  res.json(await parkingService.setRates(id(req), ratesBody.parse(req.body)));
}

export async function setHours(req: Request, res: Response) {
  res.json(await parkingService.setHours(id(req), hoursBody.parse(req.body)));
}

export async function listSlots(req: Request, res: Response) {
  res.json(await slotService.listSlots(id(req), slotQuery.parse(req.query), isAdmin(req)));
}

export async function createSlot(req: Request, res: Response) {
  res.status(201).json(await slotService.createSlot(id(req), slotSchema.parse(req.body)));
}

export async function updateSlot(req: Request, res: Response) {
  res.json(await slotService.updateSlot(id(req), slotUpdateSchema.parse(req.body)));
}

export async function changeSlotStatus(req: Request, res: Response) {
  res.json(await slotService.changeSlotStatus(id(req), slotStatusSchema.parse(req.body)));
}

export async function deleteSlot(req: Request, res: Response) {
  await slotService.deleteSlot(id(req));
  res.status(204).end();
}
