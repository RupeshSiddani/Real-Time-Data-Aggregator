import { RateLimiter } from '../../src/utils/rateLimiter';

describe('RateLimiter', () => {
  test('should allow requests within limit', async () => {
    const limiter = new RateLimiter({
      maxRequests: 5,
      windowMs: 1000,
      identifier: 'test',
    });

    for (let i = 0; i < 5; i++) {
      const allowed = await limiter.checkLimit();
      expect(allowed).toBe(true);
    }
  });

  test('should block requests exceeding limit', async () => {
    const limiter = new RateLimiter({
      maxRequests: 3,
      windowMs: 1000,
      identifier: 'test',
    });

    for (let i = 0; i < 3; i++) {
      await limiter.checkLimit();
    }

    const blocked = await limiter.checkLimit();
    expect(blocked).toBe(false);
  });

  test('should reset after window expires', async () => {
    const limiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 500,
      identifier: 'test',
    });

    await limiter.checkLimit();
    await limiter.checkLimit();

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 600));

    const allowed = await limiter.checkLimit();
    expect(allowed).toBe(true);
  }, 10000);

  test('should handle different keys separately', async () => {
    const limiter = new RateLimiter({
      maxRequests: 2,
      windowMs: 1000,
      identifier: 'test',
    });

    await limiter.checkLimit('key1');
    await limiter.checkLimit('key1');

    const key1Blocked = await limiter.checkLimit('key1');
    const key2Allowed = await limiter.checkLimit('key2');

    expect(key1Blocked).toBe(false);
    expect(key2Allowed).toBe(true);
  });
});