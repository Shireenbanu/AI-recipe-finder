const request = require('supertest');

const BASE_URL = 'http://localhost:3000';

describe('Medical Conditions API Tests', () => {
  // Test 1: Get All Medical Conditions
  test('GET /api/medical-conditions - Get all conditions', async () => {
    const response = await request(BASE_URL)
      .get('/api/medical-conditions')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.conditions).toBeInstanceOf(Array);
    expect(response.body.conditions.length).toBeGreaterThan(0);
    expect(response.body.conditions[0]).toHaveProperty('name');
    expect(response.body.conditions[0]).toHaveProperty('recommended_nutrients');
  });

  // Test 2: Search Medical Conditions
  test('GET /api/medical-conditions/search - Search conditions', async () => {
    const response = await request(BASE_URL)
      .get('/api/medical-conditions/search?q=vitamin')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.conditions).toBeInstanceOf(Array);
  });

  // Test 3: Get Single Condition by ID
  test('GET /api/medical-conditions/:id - Get condition by ID', async () => {
    // First get all conditions to get a valid ID
    const listResponse = await request(BASE_URL).get('/api/medical-conditions');
    const conditionId = listResponse.body.conditions[0].id;

    const response = await request(BASE_URL)
      .get(`/api/medical-conditions/${conditionId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.condition).toHaveProperty('name');
  });
});