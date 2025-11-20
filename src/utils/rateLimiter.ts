import { logger } from './logger';

interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
  identifier: string;
}

interface RequestRecord {
  timestamp: number;
  count: number;
}

export class RateLimiter {
  private requests: Map<string, RequestRecord[]> = new Map();
  private options: RateLimiterOptions;

  constructor(options: RateLimiterOptions) {
    this.options = options;
  }

  async checkLimit(key: string = 'default'): Promise<boolean> {
    const fullKey = `${this.options.identifier}:${key}`;
    const now = Date.now();
    const windowStart = now - this.options.windowMs;

    let records = this.requests.get(fullKey) || [];
    records = records.filter(r => r.timestamp > windowStart);

    const totalRequests = records.reduce((sum, r) => sum + r.count, 0);

    if (totalRequests >= this.options.maxRequests) {
      logger.warn(`Rate limit exceeded for ${fullKey}`, {
        current: totalRequests,
        max: this.options.maxRequests,
      });
      return false;
    }

    records.push({ timestamp: now, count: 1 });
    this.requests.set(fullKey, records);

    return true;
  }

  async waitForSlot(key: string = 'default'): Promise<void> {
    let canProceed = await this.checkLimit(key);
    let attempts = 0;
    const maxAttempts = 10;

    while (!canProceed && attempts < maxAttempts) {
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      logger.debug(`Rate limit hit, waiting ${delay}ms before retry`, { key, attempts });
      await this.sleep(delay);
      canProceed = await this.checkLimit(key);
      attempts++;
    }

    if (!canProceed) {
      throw new Error(`Rate limit exceeded after ${maxAttempts} attempts`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  reset(key?: string): void {
    if (key) {
      const fullKey = `${this.options.identifier}:${key}`;
      this.requests.delete(fullKey);
    } else {
      this.requests.clear();
    }
  }
}

export default RateLimiter;