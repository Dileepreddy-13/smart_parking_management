import { io, type Socket } from 'socket.io-client';
import { API_ORIGIN, tokenStore } from '../api/client';

let socket: Socket | undefined;

/** One shared connection. Reconnects with the current token whenever the signed-in user changes. */
export function connectSocket(): Socket {
  socket?.disconnect();
  socket = io(API_ORIGIN || undefined, { auth: { token: tokenStore.get() ?? undefined }, transports: ['websocket', 'polling'] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = undefined;
}
