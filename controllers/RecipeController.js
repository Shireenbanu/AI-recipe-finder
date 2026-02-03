import * as Recipe from '../models/Recipe.js';
import * as User from '../models/User.js';
import * as LLMService from '../services/llmService.js';
import { logPerformance, trackRDS } from '../services/splunkLogger.js';
const startTime = Date.now();


// Get personalized recipe recommendations
export async function getRecommendations(req, res) {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'User ID is required' });

    // 1. Get nutritional needs
    const { conditions, nutritionalNeeds } = await trackRDS(req, 'READ_USER_NEEDS', () =>
      User.getUserNutritionalNeeds(userId)
    );

    if (conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User has no medical conditions set.'
      });
    }

    // 2. Check existing recipes
    let recipes = await trackRDS(req, 'READ_EXISTING_RECIPES', () =>
      Recipe.getRecipesByNutrients(nutritionalNeeds)
    );
    // 3. Generate via LLM if pool is small
    console.log("Recipes found", recipes)
    const highNeedsKeys = Object.entries(nutritionalNeeds)
      .filter(([key, value]) => value === 'high')
      .map(([key, value]) => key);

    if (recipes.length < 3) {

      const newRecipes = await LLMService.generateRecipes(nutritionalNeeds, conditions, 5, req);
   
      for (const recipeData of newRecipes) {
        try {
          const savedRecipe = await trackRDS(req, 'WRITE_CREATE_RECIPE', () =>
            Recipe.createRecipe({
              title: recipeData.title,
              description: recipeData.description,
              ingredients: recipeData.ingredients,
              instructions: recipeData.instructions,
              nutritionalInfo: recipeData.nutritional_info,
              prepTime: recipeData.prep_time || 15, // Default to 15 mins
              cookTime: recipeData.cook_time || 20, // Default to 20 mins
              servings: recipeData.servings || 2,
              difficulty: recipeData.difficulty || 'Medium',
              nutritional_needs: highNeedsKeys
            })
          );

          recipes.push(savedRecipe);

          await trackRDS(req, 'WRITE_LOG_RECOMMENDATION', () =>
            Recipe.logRecommendation(userId, savedRecipe.id, conditions.map(c => c.name))
          );
        } catch (error) {
          // Error already logged by trackRDS wrapper
        }
      }
    } else {
      // Log existing recommendations
      for (const recipe of recipes.slice(0, 5)) {
        await trackRDS(req, 'WRITE_LOG_EXISTING_REC', () =>
          Recipe.logRecommendation(userId, recipe.id, conditions.map(c => c.name))
        );
      }
    }

    res.json({
      success: true,
      recommendations: recipes.slice(0, 10),
      matchedConditions: conditions,
      nutritionalNeeds
    });
  } catch (error) {
    logPerformance(req, 'GET_RECOMMENDATIONS_FATAL', Date.now() - startTime, 'FAILURE', {
      failure_remark: error.message
    });
    res.status(500).json({ success: false, error: 'Failed to get recommendations' });
  }
}

// Get single recipe
export async function getRecipe(req, res) {
  try {
    const { recipeId } = req.params;
    const { userId } = req.query;

    const recipe = await trackRDS(req, 'READ_RECIPE_BY_ID', () => Recipe.getRecipeById(recipeId));
    if (!recipe) return res.status(404).json({ success: false, error: 'Recipe not found' });

    let isFavorited = false;
    if (userId) {
      isFavorited = await trackRDS(req, 'READ_CHECK_FAVORITE', () => Recipe.isFavorited(userId, recipeId));
    }

    res.json({ success: true, recipe: { ...recipe, isFavorited } });
  } catch (error) {
    logPerformance(req, 'FETCH_RECIPES_FATAL', Date.now() - startTime, 'FAILURE', {
      failure_remark: error.message
    });
    res.status(500).json({ success: false, error: 'Failed to fetch recipe' });
  }
}

// Search recipes
export async function searchRecipes(req, res) {
  try {
    const { q, limit } = req.query;
    let recipes;

    if (q) {
      // Log the text query string
      recipes = await trackRDS(req, 'READ_SEARCH_QUERY', () => Recipe.searchRecipes(q, limit || 20), {
        search_query: q,
        result_limit: limit || 20
      });
    } else {
      recipes = await trackRDS(req, 'READ_ALL_RECIPES', () => Recipe.getAllRecipes(limit || 20), {
        is_browse_all: true
      });
    }

    res.json({ success: true, recipes, count: recipes.length });
  } catch (error) {
    logPerformance(req, 'SEARCH_RECIPES_FATAL', Date.now() - startTime, 'FAILURE', {
      failure_remark: error.message
    });
    res.status(500).json({ success: false, error: 'Failed to search recipes' });
  }
}

// Add recipe to favorites
export async function addFavorite(req, res) {
  try {
    const { userId, recipeId } = req.body;
    if (!userId || !recipeId) return res.status(400).json({ success: false, error: 'IDs required' });

    const recipe = await trackRDS(req, 'READ_VERIFY_FOR_FAVORITE', () => Recipe.getRecipeById(recipeId));
    if (!recipe) return res.status(404).json({ success: false, error: 'Recipe not found' });

    const favorite = await trackRDS(req, 'WRITE_ADD_FAVORITE', () => Recipe.addToFavorites(userId, recipeId));
    res.status(201).json({ success: true, favorite });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add favorite' });
  }
}

// Remove recipe from favorites
export async function removeFavorite(req, res) {
  try {
    const { userId, recipeId } = req.params;
    const removed = await trackRDS(req, 'WRITE_REMOVE_FAVORITE', () => Recipe.removeFromFavorites(userId, recipeId));
    if (!removed) return res.status(404).json({ success: false, error: 'Favorite not found' });

    res.json({ success: true, message: 'Recipe removed' });
  } catch (error) {
    logPerformance(req, 'FAVORITE_RECIPES_FATAL', Date.now() - startTime, 'FAILURE', {
      failure_remark: error.message
    });
    res.status(500).json({ success: false, error: 'Failed to remove favorite' });
  }
}

// Get user's favorite recipes
export async function getFavorites(req, res) {
  try {
    const { userId } = req.params;
    const favorites = await trackRDS(req, 'READ_USER_FAVORITES', () => Recipe.getUserFavorites(userId));
    res.json({ success: true, favorites, count: favorites.length });
  } catch (error) {
    logPerformance(req, 'FAVORITE_RECIPES_FETCH_FATAL', Date.now() - startTime, 'FAILURE', {
      failure_remark: error.message
    });
    res.status(500).json({ success: false, error: 'Failed to fetch favorites' });
  }
}