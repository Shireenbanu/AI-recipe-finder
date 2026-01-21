import express from 'express';
import * as recipeController from '../controllers/RecipeController.js';

const router = express.Router();

// Recipe operations
router.get('/recommendations', recipeController.getRecommendations);
router.get('/search', recipeController.searchRecipes);
router.get('/:recipeId', recipeController.getRecipe);

// Favorites
router.post('/favorites', recipeController.addFavorite);
router.delete('/favorites/:userId/:recipeId', recipeController.removeFavorite);
router.get('/favorites/:userId', recipeController.getFavorites);

export default router;