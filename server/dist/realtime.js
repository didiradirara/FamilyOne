import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
let io = null;
export function initRealtime(server) {
    io = new Server(server, {
        cors: { origin: true, credentials: false },
    });
    io.on('connection', (socket) => {
        const token = socket.handshake.auth?.token;
        if (token) {
            try {
                const secret = process.env.JWT_SECRET || 'dev-secret';
                const decoded = jwt.verify(token, secret);
                socket.data.auth = decoded;
                if (decoded?.role)
                    socket.join(`role:${decoded.role}`);
            }
            catch {
                // invalid token -> disconnect
                socket.disconnect(true);
                return;
            }
        }
        socket.on('ping', () => socket.emit('pong'));
    });
    return io;
}
export function notify(event, payload) {
    io?.emit(event, payload);
}
