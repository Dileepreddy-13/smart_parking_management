import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { verifyToken } from '../utils/jwt';

let io: Server | undefined;

/**
 * Real-time channel.
 *  - every client receives `slots:changed` so availability refreshes live
 *  - an authenticated client joins `user:<id>` and receives its own notifications
 *  - admins also join `admins` for back-office activity
 */
export function initSockets(server: HttpServer): Server {
  io = new Server(server, { cors: { origin: env.FRONTEND_URL.split(','), credentials: true } });

  io.on('connection', (socket) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return;
    try {
      const payload = verifyToken(token);
      socket.join(`user:${payload.sub}`);
      if (payload.role === 'ADMIN') socket.join('admins');
    } catch {
      // Anonymous sockets still receive public availability updates.
    }
  });
  return io;
}

/** Tell everyone that slot availability in an area changed. */
export function emitSlotsChanged(areaIds: string | Iterable<string>) {
  const ids = typeof areaIds === 'string' ? [areaIds] : [...new Set(areaIds)];
  for (const areaId of ids) io?.emit('slots:changed', { areaId });
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  io?.to(`user:${userId}`).emit(event, payload);
}

/** Tell admin dashboards that reservations/payments changed. */
export function emitAdminActivity(kind: 'reservation' | 'payment' | 'user' | 'parking') {
  io?.to('admins').emit('admin:activity', { kind, at: new Date().toISOString() });
}
