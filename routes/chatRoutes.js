import express from 'express';
import * as LLMService from '../services/llmService.js';

const router = express.Router();

// Chat endpoint for cooking assistance
router.post('/', async (req, res) => {
  try {
    const { messages, recipeContext } = req.body;

    // Validate messages
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required and must not be empty'
      });
    }

    // Validate recipeContext
    if (!recipeContext || !recipeContext.title) {
      return res.status(400).json({
        success: false,
        error: 'Recipe context with title is required'
      });
    }

    // Ensure last message is from user
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== 'user') {
      return res.status(400).json({
        success: false,
        error: 'Last message must be from user'
      });
    }

    // Call Gemini API
    const response = await LLMService.getCookingAssistance(messages, recipeContext);

    res.json({
      success: true,
      message: response
    });
  } catch (error) {
    console.error('Error in chat:', error);
    
    // Handle specific error cases
    if (error.message.includes('API key')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing API key'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to get cooking assistance'
    });
  }
});

export default router;