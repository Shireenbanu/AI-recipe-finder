import * as Recipe from '../models/Recipe.js';
import * as User from '../models/User.js';
import * as LLMService from '../services/llmService.js';

// Get personalized recipe recommendations
export async function getRecommendations(req, res) {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Get user's nutritional needs
    const { conditions, nutritionalNeeds } = await User.getUserNutritionalNeeds(userId);

    if (conditions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'User has no medical conditions set. Please add medical conditions first.'
      });
    }

    // Check if we have existing recipes that match
    let recipes = await Recipe.getRecipesByNutrients(nutritionalNeeds);

    // If we don't have enough recipes, generate new ones
    if (recipes.length < 5) {
      console.log('Generating new recipes with LLM...');
      const newRecipes = await LLMService.generateRecipes(nutritionalNeeds, conditions, 5);

      // Save new recipes to database
      for (const recipeData of newRecipes) {
        try {
          const savedRecipe = await Recipe.createRecipe({
            title: recipeData.title,
            description: recipeData.description,
            ingredients: recipeData.ingredients,
            instructions: recipeData.instructions,
            nutritionalInfo: recipeData.nutritional_info,
            prepTime: recipeData.prep_time,
            cookTime: recipeData.cook_time,
            servings: recipeData.servings,
            difficulty: recipeData.difficulty,
            tags: recipeData.tags
          });

          recipes.push(savedRecipe);

          // Generate and log recommendation reasoning
        //   const reasoning = await LLMService.generateRecommendationReasoning(
        //     savedRecipe,
        //     conditions,
        //     nutritionalNeeds
        //   );

          await Recipe.logRecommendation(
            userId,
            savedRecipe.id,
            conditions.map(c => c.name),
          );
        } catch (error) {
          console.error('Error saving recipe:', error);
        }
      }
    } else {
      // Log existing recipe recommendations
      for (const recipe of recipes.slice(0, 5)) {

        await Recipe.logRecommendation(
          userId,
          recipe.id,
          conditions.map(c => c.name),
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
    console.error('Error getting recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recipe recommendations'
    });
  }
}

// Get single recipe
export async function getRecipe(req, res) {
  try {
    const { recipeId } = req.params;
    const { userId } = req.query;

    const recipe = await Recipe.getRecipeById(recipeId);

    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }

    // Check if favorited (if userId provided)
    let isFavorited = false;
    if (userId) {
      isFavorited = await Recipe.isFavorited(userId, recipeId);
    }

    res.json({
      success: true,
      recipe: {
        ...recipe,
        isFavorited
      }
    });
  } catch (error) {
    console.error('Error fetching recipe:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recipe'
    });
  }
}

// Search recipes
export async function searchRecipes(req, res) {
  try {
    const { q, tags, limit } = req.query;

    let recipes;

    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      recipes = await Recipe.getRecipesByTags(tagArray);
    } else if (q) {
      recipes = await Recipe.searchRecipes(q, limit || 20);
    } else {
      recipes = await Recipe.getAllRecipes(limit || 20);
    }

    res.json({
      success: true,
      recipes,
      count: recipes.length
    });
  } catch (error) {
    console.error('Error searching recipes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search recipes'
    });
  }
}

// Add recipe to favorites
export async function addFavorite(req, res) {
  try {
    const { userId, recipeId } = req.body;

    if (!userId || !recipeId) {
      return res.status(400).json({
        success: false,
        error: 'User ID and Recipe ID are required'
      });
    }

    // Verify recipe exists
    const recipe = await Recipe.getRecipeById(recipeId);
    if (!recipe) {
      return res.status(404).json({
        success: false,
        error: 'Recipe not found'
      });
    }

    const favorite = await Recipe.addToFavorites(userId, recipeId);

    res.status(201).json({
      success: true,
      favorite
    });
  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite'
    });
  }
}

// Remove recipe from favorites
export async function removeFavorite(req, res) {
  try {
    const { userId, recipeId } = req.params;

    const removed = await Recipe.removeFromFavorites(userId, recipeId);

    if (!removed) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }

    res.json({
      success: true,
      message: 'Recipe removed from favorites'
    });
  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite'
    });
  }
}

// Get user's favorite recipes
export async function getFavorites(req, res) {
  try {
    const { userId } = req.params;

    const favorites = await Recipe.getUserFavorites(userId);

    res.json({
      success: true,
      favorites,
      count: favorites.length
    });
  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch favorites'
    });
  }
}