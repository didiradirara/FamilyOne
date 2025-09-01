import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: true, credentials: false },
  });

  io.on('connection', (socket) => {
    // Optional: auth via token -> socket.handshake.auth?.token
    // Keep it open for MVP; add auth later.
    socket.on('ping', () => socket.emit('pong'));
  });

  return io;
}

export function notify(event: string, payload: any) {
  io?.emit(event, payload);
}