import pool from '../config/database.js';

// Create a new recipe
export async function createRecipe(recipeData) {
  const {
    title,
    description,
    ingredients,
    instructions,
    nutritionalInfo,
    prepTime,
    cookTime,
    servings,
    difficulty,
    tags
  } = recipeData;

  const query = `
    INSERT INTO recipes (
      title, description, ingredients, instructions, 
      nutritional_info, prep_time, cook_time, servings, difficulty, tags
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `;

  const result = await pool.query(query, [
    title,
    description,
    JSON.stringify(ingredients),
    JSON.stringify(instructions),
    JSON.stringify(nutritionalInfo),
    prepTime,
    cookTime,
    servings,
    difficulty,
    JSON.stringify(tags)
  ]);

  return result.rows[0];
}

// Get recipe by ID
export async function getRecipeById(recipeId) {
  const query = `
    SELECT * FROM recipes
    WHERE id = $1
  `;

  const result = await pool.query(query, [recipeId]);
  return result.rows[0];
}

// Search recipes by tags
export async function getRecipesByTags(tags) {
  const query = `
    SELECT * FROM recipes
    WHERE tags @> $1
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const result = await pool.query(query, [JSON.stringify(tags)]);
  return result.rows;
}

// Search recipes by nutritional content
export async function getRecipesByNutrients(nutrients) {
  // Build a query that checks if recipe has high levels of required nutrients
  const nutrientConditions = Object.entries(nutrients)
    .filter(([_, level]) => level === 'high')
    .map(([nutrient, _]) => nutrient);

  if (nutrientConditions.length === 0) {
    return [];
  }

  // Get recipes that contain any of the required nutrients
  const query = `
    SELECT * FROM recipes
    WHERE tags ?| $1
    ORDER BY created_at DESC
    LIMIT 20
  `;

  const searchTags = nutrientConditions.map(n => `${n}-rich`);
  const result = await pool.query(query, [searchTags]);
  return result.rows;
}

// Get all recipes (with pagination)
export async function getAllRecipes(limit = 20, offset = 0) {
  const query = `
    SELECT * FROM recipes
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const result = await pool.query(query, [limit, offset]);
  return result.rows;
}

// Search recipes by title or description
export async function searchRecipes(searchTerm, limit = 20) {
  const query = `
    SELECT * FROM recipes
    WHERE title ILIKE $1 OR description ILIKE $1
    ORDER BY created_at DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [`%${searchTerm}%`, limit]);
  return result.rows;
}

// Add recipe to user favorites
export async function addToFavorites(userId, recipeId) {
  const query = `
    INSERT INTO user_favorites (user_id, recipe_id)
    VALUES ($1, $2)
    ON CONFLICT (user_id, recipe_id) DO NOTHING
    RETURNING *
  `;

  const result = await pool.query(query, [userId, recipeId]);
  return result.rows[0];
}

// Remove recipe from user favorites
export async function removeFromFavorites(userId, recipeId) {
  const query = `
    DELETE FROM user_favorites
    WHERE user_id = $1 AND recipe_id = $2
    RETURNING *
  `;

  const result = await pool.query(query, [userId, recipeId]);
  return result.rows[0];
}

// Get user's favorite recipes
export async function getUserFavorites(userId) {
  const query = `
    SELECT r.*, uf.created_at as favorited_at
    FROM recipes r
    JOIN user_favorites uf ON r.id = uf.recipe_id
    WHERE uf.user_id = $1
    ORDER BY uf.created_at DESC
  `;

  const result = await pool.query(query, [userId]);
  return result.rows;
}

// Check if recipe is favorited by user
export async function isFavorited(userId, recipeId) {
  const query = `
    SELECT EXISTS(
      SELECT 1 FROM user_favorites
      WHERE user_id = $1 AND recipe_id = $2
    ) as is_favorited
  `;

  const result = await pool.query(query, [userId, recipeId]);
  return result.rows[0].is_favorited;
}

// Log recipe recommendation
export async function logRecommendation(userId, recipeId, matchedConditions) {
  const query = `
    INSERT INTO recipe_recommendation–s (user_id, recipe_id, matched_conditions)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const result = await pool.query(query, [
    userId,
    recipeId,
    JSON.stringify(matchedConditions),
  ]);

  return result.rows[0];
}

// Get user's recommendation history
export async function getUserRecommendations(userId, limit = 20) {
  const query = `
    SELECT 
      rr.*,
      r.title as recipe_title,
      r.description as recipe_description
    FROM recipe_recommendations rr
    JOIN recipes r ON rr.recipe_id = r.id
    WHERE rr.user_id = $1
    ORDER BY rr.created_at DESC
    LIMIT $2
  `;

  const result = await pool.query(query, [userId, limit]);
  return result.rows;
}