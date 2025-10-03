interface UsageRecord {
    start: number;
    durationMs: number;
}

interface ActiveSession {
    start: number;
    allowedMs: number;
}

export interface RealtimeUsageLimiterOptions {
    limitMinutes: number;
    windowHours: number;
    superUserIds?: string[];
}

export interface RealtimeAllowance {
    allowed: boolean;
    remainingMs: number;
    limitMs: number;
    windowMs: number;
    retryAfterMs?: number;
    isSuperuser: boolean;
}

export class RealtimeUsageLimiter {
    private readonly limitMs: number;
    private readonly windowMs: number;
    private readonly superUserIds: Set<string>;
    private readonly usageRecords: Map<string, UsageRecord[]> = new Map();
    private readonly activeSessions: Map<string, ActiveSession> = new Map();

    constructor(options: RealtimeUsageLimiterOptions) {
        this.limitMs = Math.max(0, options.limitMinutes * 60_000);
        this.windowMs = Math.max(0, options.windowHours * 3_600_000);
        this.superUserIds = new Set(options.superUserIds ?? []);
    }

    private isSuperuser(userId: string | undefined): boolean {
        if (!userId) return false;
        return this.superUserIds.has(userId);
    }

    private pruneOldRecords(userId: string, now: number): void {
        const records = this.usageRecords.get(userId);
        if (!records || records.length === 0) return;

        while (records.length > 0 && now - records[0].start >= this.windowMs) {
            records.shift();
        }

        if (records.length === 0) {
            this.usageRecords.delete(userId);
        }
    }

    private getRecords(userId: string): UsageRecord[] {
        let records = this.usageRecords.get(userId);
        if (!records) {
            records = [];
            this.usageRecords.set(userId, records);
        }
        return records;
    }

    public getAllowance(userId: string): RealtimeAllowance {
        const now = Date.now();
        if (this.isSuperuser(userId)) {
            return {
                allowed: true,
                remainingMs: Number.POSITIVE_INFINITY,
                limitMs: Number.POSITIVE_INFINITY,
                windowMs: this.windowMs,
                isSuperuser: true,
            };
        }

        this.pruneOldRecords(userId, now);
        const records = this.usageRecords.get(userId) ?? [];
        const usedMs = records.reduce((total, record) => total + record.durationMs, 0);
        const remainingMs = Math.max(0, this.limitMs - usedMs);
        const allowed = remainingMs > 0;

        const allowance: RealtimeAllowance = {
            allowed,
            remainingMs,
            limitMs: this.limitMs,
            windowMs: this.windowMs,
            isSuperuser: false,
        };

        if (!allowed && records.length > 0) {
            const retryAfterMs = Math.max(0, records[0].start + this.windowMs - now);
            allowance.retryAfterMs = retryAfterMs;
        }

        return allowance;
    }

    public startSession(userId: string): ActiveSession {
        const allowance = this.getAllowance(userId);
        if (!allowance.allowed && !allowance.isSuperuser) {
            throw new Error('Realtime usage limit reached for this user.');
        }

        const now = Date.now();
        const allowedMs = allowance.isSuperuser
            ? Number.POSITIVE_INFINITY
            : Math.max(0, Math.min(allowance.remainingMs, this.limitMs));

        const active: ActiveSession = { start: now, allowedMs };
        this.activeSessions.set(userId, active);
        return active;
    }

    public endSession(userId: string, endTime: number = Date.now()): number {
        const active = this.activeSessions.get(userId);
        if (!active) {
            return 0;
        }

        this.activeSessions.delete(userId);

        if (this.isSuperuser(userId)) {
            return 0;
        }

        const duration = Math.max(0, Math.min(endTime - active.start, active.allowedMs));
        if (duration === 0) {
            return 0;
        }

        this.pruneOldRecords(userId, endTime);
        const records = this.getRecords(userId);
        records.push({ start: active.start, durationMs: duration });
        return duration;
    }

    public cancelSession(userId: string): void {
        this.activeSessions.delete(userId);
    }
}
