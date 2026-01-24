import { GoogleGenerativeAI } from "@google/generative-ai";


async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use gemini-2.0-flash for speed/cost or gemini-2.0-pro for complex reasoning
const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  generationConfig: {
    responseMimeType: "application/json",
  }
});

export async function generateRecipes(nutritionalNeeds, conditions, count = 2) {
  const conditionNames = conditions.map(c => c.name).join(', ');
  const nutrientList = Object.entries(nutritionalNeeds)
    .map(([nutrient, level]) => `${nutrient} (${level} priority)`)
    .join(', ');

  const prompt = `You are a professional nutritionist and chef. Generate ${count} healthy, delicious recipes for someone with the following medical conditions: ${conditionNames}.

Their nutritional requirements are: ${nutrientList}

Return a JSON array with this EXACT structure (no extra fields):
[
  {
    "title": "Recipe Name",
    "description": "Brief description in 2-3 sentences",
    "ingredients": [
      {"item": "ingredient name", "quantity": 1, "unit": "cup"}
    ],
    "instructions": [
      "Step 1 description",
      "Step 2 description"
    ],
    "nutritional_info": {
      "calories": 450,
      "protein": "35g",
      "carbs": "40g",
      "fat": "15g",
      "fiber": "8g",
      "vitamin_d": "high",
      "calcium": "medium"
    },
    "prep_time": 15,
    "cook_time": 30,
    "servings": 4,
    "difficulty": "easy",
    "tags": ["high-protein", "vitamin-d-rich"]
  }
]

IMPORTANT: 
- Return ONLY valid JSON, no extra text or fields
- Use lowercase for difficulty: "easy", "medium", or "hard"
- Use lowercase for nutritional levels: "high", "medium", or "low"
- Make recipes practical with common ingredients
- Ensure quantities are numbers, not strings`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    console.log('Raw Gemini response:', responseText);
    
    // Clean the response - remove any non-JSON content
    let cleanedText = responseText.trim();
    
    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/```json\n?/g, '');
    cleanedText = cleanedText.replace(/```\n?/g, '');
    
    // Find the actual JSON array (starts with [ and ends with ])
    const startIndex = cleanedText.indexOf('[');
    const endIndex = cleanedText.lastIndexOf(']');
    
    if (startIndex === -1 || endIndex === -1) {
      throw new Error('No valid JSON array found in response');
    }
    
    cleanedText = cleanedText.substring(startIndex, endIndex + 1);
    
    console.log('Cleaned JSON recieved from Gemini:', cleanedText);
    
    // Parse the JSON
    const recipes = JSON.parse(cleanedText);
    
    // Validate and normalize the recipes
    return recipes.map(recipe => ({
      title: recipe.title,
      description: recipe.description,
      ingredients: recipe.ingredients,
      instructions: recipe.instructions,
      nutritional_info: recipe.nutritional_info || recipe.nutritionalInfo, // Handle both formats
      prep_time: recipe.prep_time || recipe.prepTime || 0,
      cook_time: recipe.cook_time || recipe.cookTime || 0,
      servings: recipe.servings || 4,
      difficulty: (recipe.difficulty || 'medium').toLowerCase(),
      tags: recipe.tags || []
    }));
    
  } catch (error) {
    console.error('Gemini Recipe Error:', error);
    console.error('Error details:', error.message);
    throw new Error('Failed to generate recipes: ' + error.message);
  }
}

export async function getCookingAssistance(messages, recipeContext) {
  // Gemini prefers system instructions via the model config or prepended to history
  const chatModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash-lite",
    systemInstruction: `You are a helpful, encouraging cooking assistant. The user is making this recipe:

Title: ${recipeContext.title}
Description: ${recipeContext.description || 'A delicious recipe'}

Ingredients:
${JSON.stringify(recipeContext.ingredients, null, 2)}

Instructions:
${recipeContext.instructions ? recipeContext.instructions.map((step, i) => `${i + 1}. ${step}`).join('\n') : 'Follow the recipe steps'}

Answer their cooking questions clearly and concisely. Be supportive and give practical tips. If they ask about substitutions, timing, or techniques, provide helpful guidance.`
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const history = messages.slice(0, -1).map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const chat = chatModel.startChat({ history });
      const lastMessage = messages[messages.length - 1].content;
      const result = await chat.sendMessage(lastMessage);

      return {
        role: 'assistant',
        content: result.response.text()
      };
    } catch (error) {
      console.error(`Gemini Assistance Error (attempt ${attempt + 1}):`, error);
      
      if (error.status === 429 && attempt < 2) {
        console.log('Rate limited, waiting 5 seconds...');
        await sleep(5000);
        continue;
      }
      
      throw new Error('Failed to get cooking assistance. Please try again in a moment.');
    }
  }
}


