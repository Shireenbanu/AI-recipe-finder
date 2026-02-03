import { GoogleGenerativeAI } from "@google/generative-ai";
import { logPerformance } from './splunkLogger.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Fallback Chain: 2.0 -> 1.5 (More resilient)
const MODELS = [
  "gemini-2.0-flash",       // Try 2.0 first
  "gemini-2.5-flash-lite",  // Better fallback: very high limits, ultra-fast
  "gemini-2.5-flash"        // Final fallback
];

export async function generateRecipes(nutritionalNeeds, conditions, count = 2, req) {
  const startTime = Date.now();
  let lastError = null;

  // 1. TOKEN MINIMIZATION: Clean the data before it hits the prompt
  // Only send the names of conditions and essential nutrient values
  const compactConditions = conditions.map(c => c.name).join(',');
  const compactNutrients = JSON.stringify(nutritionalNeeds);

  // Short, instruction-heavy prompt to save input tokens
  const prompt = `JSON ONLY. Array of ${count} recipes for conditions: ${compactConditions}. Nutrients: ${compactNutrients}. Schema: {title,ingredients[],instructions[],nutritional_info:{calories,protein}}`;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: { 
          responseMimeType: "application/json",
          maxOutputTokens: 4000 // Limit output to prevent runaway costs/latency
        }
      });

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const recipes = JSON.parse(response.text());
      console.log(recipes)

      logPerformance(req, 'GEMINI_API_SUCCESS', Date.now() - startTime,'SUCCESS', {
        model_used: modelName,
        recipe_count: recipes.length,
        tokens: response.usageMetadata?.totalTokenCount
      });

      return recipes;

    } catch (error) {
      lastError = error;
      const isRateLimit = error.message?.includes('429') || error.message?.includes('Quota');
      
      if (isRateLimit) {
        console.warn(`Model ${modelName} rate limited. Trying next in chain...`);
        continue; // Move to the next model in the MODELS array
      }
      
      // If it's a different error (like 400 Bad Request), don't bother retrying
      break;
    }
  }

  // If we get here, all models failed
  logPerformance(req, 'GEMINI_API_TOTAL_FAILURE', Date.now() - startTime,'FAILURE', {
    error: lastError?.message
  });
  throw lastError;
}