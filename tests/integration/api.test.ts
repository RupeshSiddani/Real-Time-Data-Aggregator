import request from 'supertest';
import express, { Application } from 'express';
import { tokenRoutes } from '../../src/routes/token.routes';

describe('API Integration Tests', () => {
  let app: Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api', tokenRoutes);
  });

  test('GET /api/health should return 200', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('healthy');
  });

  test('GET /api/tokens should return token list', async () => {
    const response = await request(app)
      .get('/api/tokens')
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  }, 30000);

  test('GET /api/tokens with filters should return filtered results', async () => {
    const response = await request(app)
      .get('/api/tokens')
      .query({ limit: 5, sortBy: 'volume' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.length).toBeLessThanOrEqual(5);
  }, 30000);

  test('GET /api/tokens/search should search tokens', async () => {
    const response = await request(app)
      .get('/api/tokens/search')
      .query({ q: 'SOL' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
  }, 30000);

  test('GET /api/tokens/search without query should return 400', async () => {
    const response = await request(app)
      .get('/api/tokens/search')
      .expect(400);

    expect(response.body.success).toBe(false);
  });

  test('GET /api/tokens/:address should return token details', async () => {
    // First get a token address
    const listResponse = await request(app)
      .get('/api/tokens')
      .query({ limit: 1 });

    if (listResponse.body.data && listResponse.body.data.length > 0) {
      const address = listResponse.body.data[0].token_address;

      const response = await request(app)
        .get(`/api/tokens/${address}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    }
  }, 30000);
});