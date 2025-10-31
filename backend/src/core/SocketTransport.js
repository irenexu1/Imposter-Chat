/**
* File: src/app/SocketTransport.js
* Responsibility: Create a configured Socket.IO server instance, nothing else.
* Inputs: httpServer (Node HTTP server)
* Outputs: this.io (Socket.IO server)
* Config knobs: CORS etc. kept minimal here; extend if needed.
*/
import { Server } from 'socket.io';


export class SocketTransport {
    /** @param {{ httpServer:any }} deps */
    constructor({ httpServer }) {
        this.io = new Server(httpServer, { cors: { origin: '*' } });
    }
}