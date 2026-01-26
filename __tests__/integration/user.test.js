const request = require('supertest');
// import { jest } from '@jest/globals';
const est = require('@jest/globals')
jest = est.jest
// Mock the server without starting it
const BASE_URL = 'http://localhost:3000';

describe('User API Tests', () => {
  let testUserId;
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    name: 'Test User'
  };

  // Test 1: Create User
  test('POST /api/users - Create new user', async () => {
    const response = await request(BASE_URL)
      .post('/api/users')
      .send(testUser)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.user).toHaveProperty('id');
    expect(response.body.user.email).toBe(testUser.email);
    expect(response.body.user.name).toBe(testUser.name);

    testUserId = response.body.user.id;
  });

  // Test 2: Get User Profile
  test('GET /api/users/:userId - Get user profile', async () => {
    const response = await request(BASE_URL)
      .get(`/api/users/${testUserId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.id).toBe(testUserId);
    expect(response.body.user.email).toBe(testUser.email);
  });

  // Test 3: Update User Profile
  test('PUT /api/users/:userId - Update user profile', async () => {
    const updates = { name: 'Updated Name' };

    const response = await request(BASE_URL)
      .put(`/api/users/${testUserId}`)
      .send(updates)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.name).toBe('Updated Name');
  });

  // Test 4: Get User by Email
  test('GET /api/users/email/:email - Get user by email', async () => {
    const response = await request(BASE_URL)
      .get(`/api/users/email/${testUser.email}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.user.email).toBe(testUser.email);
  });

  // Test 5: Validation - Missing required fields
  test('POST /api/users - Should fail without email', async () => {
    const response = await request(BASE_URL)
      .post('/api/users')
      .send({ name: 'No Email User' })
      .expect(400);

    expect(response.body.success).toBe(false);
  });
});