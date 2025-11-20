import { logger } from './logger';

interface RetryOptions {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryableErrors?: string[];
}

export class RetryHandler {
  private options: RetryOptions;

  constructor(options: Partial<RetryOptions> = {}) {
    this.options = {
      maxRetries: options.maxRetries || 3,
      baseDelay: options.baseDelay || 1000,
      maxDelay: options.maxDelay || 10000,
      retryableErrors: options.retryableErrors || ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'],
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    context: string = 'operation'
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt === this.options.maxRetries) {
          logger.error(`${context} failed after ${this.options.maxRetries} retries`, {
            error: error.message,
          });
          break;
        }

        const isRetryable = this.isRetryableError(error);
        if (!isRetryable) {
          logger.warn(`${context} failed with non-retryable error`, {
            error: error.message,
          });
          throw error;
        }

        const delay = this.calculateDelay(attempt);
        logger.info(`${context} failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries: this.options.maxRetries,
          error: error.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error(`${context} failed`);
  }

  private isRetryableError(error: any): boolean {
    if (error.code && this.options.retryableErrors?.includes(error.code)) {
      return true;
    }

    if (error.response?.status === 429) {
      return true;
    }

    if (error.response?.status >= 500) {
      return true;
    }

    return false;
  }

  private calculateDelay(attempt: number): number {
    const delay = this.options.baseDelay * Math.pow(2, attempt);
    return Math.min(delay, this.options.maxDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default RetryHandler;