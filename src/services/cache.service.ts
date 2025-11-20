import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export class CacheService {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (err) => {
      this.isConnected = false;
      logger.error('Redis connection error', { error: err.message });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error: any) {
      logger.error('Failed to connect to Redis', { error: error.message });
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.getFullKey(key);
      const value = await this.client.get(fullKey);
      
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error: any) {
      logger.error('Cache get error', { key, error: error.message });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const serialized = JSON.stringify(value);
      const cacheTTL = ttl || config.cache.ttl;

      await this.client.setex(fullKey, cacheTTL, serialized);
      return true;
    } catch (error: any) {
      logger.error('Cache set error', { key, error: error.message });
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      await this.client.del(fullKey);
      return true;
    } catch (error: any) {
      logger.error('Cache delete error', { key, error: error.message });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const fullKey = this.getFullKey(key);
      const result = await this.client.exists(fullKey);
      return result === 1;
    } catch (error: any) {
      logger.error('Cache exists error', { key, error: error.message });
      return false;
    }
  }

  async deletePattern(pattern: string): Promise<number> {
    try {
      const fullPattern = this.getFullKey(pattern);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      await this.client.del(...keys);
      return keys.length;
    } catch (error: any) {
      logger.error('Cache delete pattern error', { pattern, error: error.message });
      return 0;
    }
  }

  async clear(): Promise<boolean> {
    try {
      await this.client.flushdb();
      logger.info('Cache cleared successfully');
      return true;
    } catch (error: any) {
      logger.error('Cache clear error', { error: error.message });
      return false;
    }
  }

  isReady(): boolean {
    return this.isConnected;
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
    logger.info('Redis disconnected');
  }

  private getFullKey(key: string): string {
    return `${config.cache.prefix}${key}`;
  }
}

export default CacheService;