const request = require('supertest');

const BASE_URL = 'http://localhost:3000';

describe('Recipe API Tests', () => {
  let testUserId;
  let testConditionId;

  beforeAll(async () => {
    // Create test user
    const userResponse = await request(BASE_URL)
      .post('/api/users')
      .send({
        email: `recipe-test-${Date.now()}@example.com`,
        name: 'Recipe Test User'
      });
    testUserId = userResponse.body.user.id;

    // Get a medical condition
    const conditionsResponse = await request(BASE_URL)
      .get('/api/medical-conditions');
    testConditionId = conditionsResponse.body.conditions[0].id;

    // Add condition to user
    await request(BASE_URL)
      .post(`/api/users/${testUserId}/conditions`)
      .send({
        conditionId: testConditionId,
        severity: 'moderate'
      });
  });

  // Test 1: Get Recipe Recommendations
  test('GET /api/recipes/recommendations - Get recommendations', async () => {
    const response = await request(BASE_URL)
      .get(`/api/recipes/recommendations?userId=${testUserId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.recommendations).toBeInstanceOf(Array);
    expect(response.body).toHaveProperty('matchedConditions');
    expect(response.body).toHaveProperty('nutritionalNeeds');
  }, 30000); // 30 second timeout for LLM API

  // Test 2: Search Recipes
  test('GET /api/recipes/search - Search recipes', async () => {
    const response = await request(BASE_URL)
      .get('/api/recipes/search?q=salmon')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.recipes).toBeInstanceOf(Array);
  });

  // Test 3: Get Single Recipe (after recommendations)
  test('GET /api/recipes/:recipeId - Get recipe by ID', async () => {
    // First get recommendations to have a recipe
    const recResponse = await request(BASE_URL)
      .get(`/api/recipes/recommendations?userId=${testUserId}`);
    
    const recipeId = recResponse.body.recommendations[0].id;

    const response = await request(BASE_URL)
      .get(`/api/recipes/${recipeId}?userId=${testUserId}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.recipe).toHaveProperty('title');
    expect(response.body.recipe).toHaveProperty('ingredients');
  }, 30000);
});