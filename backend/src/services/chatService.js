/**
 * ChatService
 *
 * Responsibility:
 *  - Acts as the domain-level interface for chat messages.
 *  - Persists chat messages to storage.
 *  - Publishes chat events to Redis for multi-process broadcast.
 *
 * This service performs *no* WebSocket or UI work, and contains *no*
 * message interpretation / commands / AI logic. Higher-level
 * routing (e.g., detecting +score or triggering AI) should call this
 * service to perform persistence + broadcast.
 *
 * Inputs:
 *  - text, room, user metadata (supplied by SocketHandler or a router)
 *
 * Outputs:
 *  - Writes to `db`
 *  - Publishes structured messages to Redis pub/sub
 *
 * Notes:
 *  - This service is side-effectful by design (DB + Redis).
 *  - It does not return messages to clients; that is the job of SocketHandler,
 *    which reacts to Redis pub/sub via `_onRedis`.
 */
export default class ChatService {

    /**
     * @param {object} deps
     * @param {import('../core/RedisManager.js').default} deps.redis  Redis manager (publish/subscribe bus)
     * @param {import('../core/Database.js').default} deps.db        Message persistence interface
     */
    constructor({ redis, db }) {
        /** @private */
        this.redis = redis;
        /** @private */
        this.db = db;
    }

    /**
     * Persist a chat message for audit/history.
     *
     * @param {object} params
     * @param {string} params.socketId  ID of the sending client socket
     * @param {string} params.text      Raw chat text
     * @param {string} params.room      Logical chat room
     *
     * @returns {Promise<void>}
     */
    async persist({ socketId, text, room }) {
        await this.db.insertMessage(socketId, text, room);
    }

    /**
     * Publish a chat event to Redis so that all servers (and thus all connected clients)
     * see the same message. This is the synchronization boundary for distributed chat.
     *
     * @param {object} params
     * @param {string} params.user    Display name or username
     * @param {string} params.text    Chat content
     * @param {string} params.room    Target chat room
     * @param {string} [params.role]  User role ("user" | "system")
     *
     * @returns {Promise<number>} The number of Redis subscribers that received the message
     */
    async publish({ user, text, room, role = 'user' }) {
        return this.redis.publish(this.redis.config.redis.channels.chat, {
            user,
            text,
            room,
            role,
            timestamp: new Date().toISOString(),
        });
    }
}
