import { GoogleGenerativeAI } from "@google/generative-ai";
import { logPerformance } from './splunkLogger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const LLMVersion = "gemini-2.0-flash"
const model = genAI.getGenerativeModel({
  model: LLMVersion,
  generationConfig: { responseMimeType: "application/json" }
});

export async function generateRecipes(nutritionalNeeds, conditions, count = 2, req) {
  const startTime = Date.now();

  try {
    const conditionNames = conditions.map(c => c.name).join(', ');
    const nutrientList = Object.entries(nutritionalNeeds)
      .map(([n, l]) => `${n} (${l})`).join(', ');

    const prompt = `Generate ${count} recipes for: ${conditionNames}. Needs: ${nutrientList}...`; // Your existing prompt

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    const usage = result.response.usageMetadata;
    const tokensProcessed = usage?.totalTokenCount || 0;
    // Cleaning and Parsing
    let cleanedText = responseText.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const recipes = JSON.parse(cleanedText.substring(cleanedText.indexOf('['), cleanedText.lastIndexOf(']') + 1));

    // Log Performance on Success
    logPerformance(req, 'GEMINI_API', Date.now() - startTime, {
      recipe_count: recipes.length,
      tokens_processed: tokensProcessed,
      condition_count: conditions.length,
      prompt_tokens: usage?.promptTokenCount,
      completion_tokens: usage?.candidatesTokenCount,
      model_used: LLMVersion
    });

    return recipes;

  } catch (error) {
    // Log Performance on Failure
    logPerformance(req, 'GEMINI_API', Date.now() - startTime, {
      error: error.message,
      status: 'failed',
      model_used: LLMVersion
    });
    throw error;
  }
}

// Not being used anywhere
export async function getCookingAssistance(messages, recipeContext, req) {
  const startTime = Date.now();
  const chatModel = genAI.getGenerativeModel({
    model: LLMVersion,
    systemInstruction: `You are a chef for: ${recipeContext.title}...`
  });

  try {
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat = chatModel.startChat({ history });
    const result = await chat.sendMessage(messages[messages.length - 1].content);
    const aiResponse = result.response.text();

    logPerformance(req, 'COOKING_ASSISTANCE_SUCCESS', Date.now() - startTime, {
      recipe_id: recipeContext.id || 'unknown',
      message_count: messages.length
    });

    return { role: 'assistant', content: aiResponse };

  } catch (error) {
    logPerformance(req, 'COOKING_ASSISTANCE_ERROR', Date.now() - startTime, {
      error: error.message
    });
    throw error;
  }
}