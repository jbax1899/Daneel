import WebSocket from 'ws';
import { logger } from '../utils/logger.js';
import { RECONNECTION_CONSTANTS } from '../constants/voice.js';
export class RealtimeWebSocketManager {
    ws = null;
    isConnected = false;
    connectionPromise = null;
    connectionResolver = null;
    connectionRejector = null;
    isConnecting = false;
    reconnectAttempts = 0;
    maxReconnectAttempts = RECONNECTION_CONSTANTS.MAX_RECONNECT_ATTEMPTS;
    reconnectDelay = RECONNECTION_CONSTANTS.INITIAL_RECONNECT_DELAY;
    maxReconnectDelay = RECONNECTION_CONSTANTS.MAX_RECONNECT_DELAY;
    reconnectTimer = null;
    messageCallbacks = new Set();
    eventListeners = new Map();
    constructor() {
        // Initialize
    }
    async connect(url, headers) {
        // If already connected, return immediately
        if (this.isConnected) {
            throw new Error('Session is already connected');
        }
        // If already connecting, return the existing promise
        if (this.isConnecting && this.connectionPromise) {
            return this.connectionPromise;
        }
        // If there's a stale connection promise (connection failed but promise wasn't cleaned up)
        if (this.connectionPromise && !this.isConnecting) {
            this.connectionPromise = null;
            this.connectionResolver = null;
            this.connectionRejector = null;
        }
        this.isConnecting = true;
        this.reconnectAttempts = 0;
        this.connectionPromise = new Promise((resolve, reject) => {
            this.connectionResolver = resolve;
            this.connectionRejector = reject;
            this.attemptConnection(url, headers, resolve, reject);
        });
        return this.connectionPromise;
    }
    attemptConnection(url, headers, resolve, reject) {
        try {
            const ws = new WebSocket(url, { headers });
            this.ws = ws;
            ws.on('open', () => {
                this.isConnected = true;
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.clearReconnectTimer();
                this.connectionResolver?.();
                ws.on('message', (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        // Emit the specific event type
                        if (message.type) {
                            this.emit(message.type, message);
                        }
                        // Emit generic 'event' with full message
                        this.emit('event', message);
                        // Forward to registered callbacks
                        this.messageCallbacks.forEach(cb => {
                            try {
                                cb(data);
                            }
                            catch (error) {
                                logger.error('Error in message callback:', error);
                            }
                        });
                    }
                    catch (error) {
                        logger.error('Error processing WebSocket message:', error);
                    }
                });
                ws.on('error', (error) => {
                    logger.error('WebSocket error:', error);
                    this.handleConnectionError(error, url, headers, resolve, reject);
                });
                ws.on('close', (code) => {
                    this.cleanupConnectionPromise();
                    this.cleanup();
                    if (code !== 1000 && code !== 1001) {
                        this.scheduleReconnection(url, headers);
                    }
                });
            });
        }
        catch (error) {
            logger.error('Error creating WebSocket connection:', error);
            this.isConnecting = false;
            this.handleConnectionError(error instanceof Error ? error : new Error(String(error)), url, headers, resolve, reject);
        }
    }
    handleConnectionError(error, url, headers, _resolve, _reject) {
        this.isConnected = false;
        this.isConnecting = false;
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            logger.warn(`Connection failed, attempting reconnection (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
            this.scheduleReconnection(url, headers);
        }
        else {
            logger.error('Max reconnection attempts reached, giving up');
            this.connectionRejector?.(error);
            this.cleanupConnectionPromise();
            this.cleanup();
        }
    }
    scheduleReconnection(url, headers) {
        this.reconnectAttempts++;
        const delay = Math.min(this.reconnectDelay * Math.pow(RECONNECTION_CONSTANTS.RECONNECT_BACKOFF_MULTIPLIER, this.reconnectAttempts - 1), this.maxReconnectDelay);
        logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
        this.reconnectTimer = setTimeout(() => {
            if (!this.isConnected && !this.isConnecting) {
                this.connectionPromise = new Promise((resolve, reject) => {
                    this.connectionResolver = resolve;
                    this.connectionRejector = reject;
                    this.attemptConnection(url, headers, resolve, reject);
                });
            }
        }, delay);
    }
    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    cleanupConnectionPromise() {
        this.connectionPromise = null;
        this.connectionResolver = null;
        this.connectionRejector = null;
    }
    cleanup() {
        this.clearReconnectTimer();
        if (this.ws) {
            try {
                this.ws.removeAllListeners();
            }
            catch (error) {
                logger.error('Error cleaning up WebSocket listeners:', error);
            }
        }
    }
    disconnect() {
        if (this.ws && this.isConnected) {
            this.ws.close();
        }
        this.cleanup();
    }
    send(data) {
        if (!this.isConnected || !this.ws) {
            throw new Error('Session is not connected');
        }
        this.ws.send(data);
    }
    isConnectionReady() {
        return this.isConnected && this.ws !== null;
    }
    onMessage(callback) {
        this.messageCallbacks.add(callback);
        /*
        if (this.ws) {
            this.ws.on('message', callback);
        }
        */
    }
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)?.add(callback);
    }
    off(event, callback) {
        this.eventListeners.get(event)?.delete(callback);
    }
    emit(event, data) {
        this.eventListeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            }
            catch (error) {
                logger.error(`Error in ${event} handler:`, error);
            }
        });
    }
    offMessage(callback) {
        this.messageCallbacks.delete(callback);
        if (this.ws) {
            this.ws.off('message', callback);
        }
    }
    onError(callback) {
        if (this.ws) {
            this.ws.on('error', callback);
        }
    }
    onClose(callback) {
        if (this.ws) {
            this.ws.on('close', callback);
        }
    }
    getWebSocket() {
        return this.ws;
    }
}
//# sourceMappingURL=RealtimeWebSocketManager.js.map