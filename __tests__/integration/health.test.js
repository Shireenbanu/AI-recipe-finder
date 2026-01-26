const request = require('supertest');

const BASE_URL = 'http://localhost:3000';

describe('Health Check Tests', () => {
  test('GET /api/health - Server is running', async () => {
    const response = await request(BASE_URL)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.status).toBe('ok');
    expect(response.body.message).toContain('Recipe Finder API');
  });
});