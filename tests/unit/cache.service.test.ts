import CacheService from '../../src/services/cache.service';

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeAll(async () => {
    cacheService = new CacheService();
    await cacheService.connect();
  });

  afterAll(async () => {
    await cacheService.clear();
    await cacheService.disconnect();
  });

  beforeEach(async () => {
    await cacheService.clear();
  });

  test('should set and get value', async () => {
    const key = 'test-key';
    const value = { name: 'Test Token', price: 123 };

    await cacheService.set(key, value, 60);
    const retrieved = await cacheService.get(key);

    expect(retrieved).toEqual(value);
  });

  test('should return null for non-existent key', async () => {
    const retrieved = await cacheService.get('non-existent');
    expect(retrieved).toBeNull();
  });

  test('should delete value', async () => {
    const key = 'test-key';
    const value = { name: 'Test Token' };

    await cacheService.set(key, value);
    await cacheService.delete(key);
    const retrieved = await cacheService.get(key);

    expect(retrieved).toBeNull();
  });

  test('should check if key exists', async () => {
    const key = 'test-key';
    const value = { name: 'Test Token' };

    await cacheService.set(key, value);
    const exists = await cacheService.exists(key);

    expect(exists).toBe(true);
  });

  test('should return false for non-existent key exists check', async () => {
    const exists = await cacheService.exists('non-existent');
    expect(exists).toBe(false);
  });
});