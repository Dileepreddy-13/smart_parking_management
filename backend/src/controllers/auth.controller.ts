import type { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import * as vehicleService from '../services/vehicle.service';
import { userDashboard } from '../services/dashboard.service';
import { idParam, loginSchema, passwordSchema, profileSchema, registerSchema, vehicleSchema } from '../validators';

export async function register(req: Request, res: Response) {
  res.status(201).json(await authService.register(registerSchema.parse(req.body)));
}

export async function login(req: Request, res: Response) {
  res.json(await authService.login(loginSchema.parse(req.body)));
}

/** JWTs are stateless: the client discards its token. The endpoint exists so logout is explicit and auditable. */
export async function logout(_req: Request, res: Response) {
  res.json({ message: 'Logged out.' });
}

export async function me(req: Request, res: Response) {
  res.json({ user: req.user });
}

export async function updateProfile(req: Request, res: Response) {
  res.json({ user: await authService.updateProfile(req.user!.id, profileSchema.parse(req.body)) });
}

export async function changePassword(req: Request, res: Response) {
  await authService.changePassword(req.user!.id, passwordSchema.parse(req.body));
  res.json({ message: 'Password updated.' });
}

export async function listVehicles(req: Request, res: Response) {
  res.json(await vehicleService.listVehicles(req.user!.id));
}

export async function addVehicle(req: Request, res: Response) {
  res.status(201).json(await vehicleService.addVehicle(req.user!.id, vehicleSchema.parse(req.body)));
}

export async function removeVehicle(req: Request, res: Response) {
  await vehicleService.removeVehicle(req.user!.id, idParam.parse(req.params).id);
  res.status(204).end();
}

export async function dashboard(req: Request, res: Response) {
  res.json(await userDashboard(req.user!.id));
}
