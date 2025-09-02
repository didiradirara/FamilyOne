import { Server } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: true, credentials: false },
  });

  io.on('connection', (socket) => {
    const token = (socket.handshake as any).auth?.token as string | undefined;
    if (token) {
      try {
        const secret = process.env.JWT_SECRET || 'dev-secret';
        const decoded = jwt.verify(token, secret) as any;
        (socket.data as any).auth = decoded;
        if (decoded?.role) socket.join(`role:${decoded.role}`);
      } catch {
        // invalid token -> disconnect
        socket.disconnect(true);
        return;
      }
    }

    socket.on('ping', () => socket.emit('pong'));
  });

  return io;
}

export function notify(event: string, payload: any) {
  io?.emit(event, payload);
}
