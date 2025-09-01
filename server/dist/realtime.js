import { Server } from 'socket.io';
let io = null;
export function initRealtime(server) {
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
export function notify(event, payload) {
    io?.emit(event, payload);
}
