import { logger } from '../utils/logger.js';
export class Event {
    name;
    once;
    constructor(options) {
        this.name = options.name;
        this.once = options.once ?? false;
    }
    register(client) {
        if (this.once) {
            client.once(this.name, this._execute.bind(this));
        }
        else {
            client.on(this.name, this._execute.bind(this));
        }
    }
    async _execute(...args) {
        try {
            await this.execute(...args);
        }
        catch (error) {
            logger.error(`Error in event ${this.name}:`, error);
        }
    }
}
//# sourceMappingURL=Event.js.map