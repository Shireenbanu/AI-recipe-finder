import React, { useState } from 'react';
import { Search, ChefHat, Clock, Users, Heart, Star, X, Loader, Sparkles } from 'lucide-react';

export default function RecipeFinderApp() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [favorites, setFavorites] = useState([]);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [loading, setLoading] = useState(false);
  const [recipeDetails, setRecipeDetails] = useState({});
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);

  const recipes = [
    {
      id: 1,
      name: 'Classic Spaghetti Carbonara',
      category: 'Italian',
      time: '25 min',
      servings: 4,
      difficulty: 'Medium',
      rating: 4.8,
      image: '🍝',
      description: 'Creamy Roman pasta dish with eggs and cheese'
    },
    {
      id: 2,
      name: 'Chicken Tikka Masala',
      category: 'Indian',
      time: '45 min',
      servings: 6,
      difficulty: 'Medium',
      rating: 4.9,
      image: '🍛',
      description: 'Rich and creamy curry with tender chicken'
    },
    {
      id: 3,
      name: 'Avocado Toast',
      category: 'Breakfast',
      time: '10 min',
      servings: 2,
      difficulty: 'Easy',
      rating: 4.5,
      image: '🥑',
      description: 'Simple and healthy breakfast classic'
    },
    {
      id: 4,
      name: 'Beef Tacos',
      category: 'Mexican',
      time: '30 min',
      servings: 4,
      difficulty: 'Easy',
      rating: 4.7,
      image: '🌮',
      description: 'Flavorful tacos with seasoned beef'
    },
    {
      id: 5,
      name: 'Caesar Salad',
      category: 'Salad',
      time: '15 min',
      servings: 4,
      difficulty: 'Easy',
      rating: 4.6,
      image: '🥗',
      description: 'Crisp salad with homemade dressing'
    },
    {
      id: 6,
      name: 'Chocolate Chip Cookies',
      category: 'Dessert',
      time: '35 min',
      servings: 24,
      difficulty: 'Easy',
      rating: 4.9,
      image: '🍪',
      description: 'Classic chewy cookies with chocolate chips'
    }
  ];

  const categories = ['all', 'Italian', 'Indian', 'Mexican', 'Breakfast', 'Salad', 'Dessert'];

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = recipe.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || recipe.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const toggleFavorite = (id) => {
    if (favorites.includes(id)) {
      setFavorites(favorites.filter(fav => fav !== id));
    } else {
      setFavorites([...favorites, id]);
    }
  };

  // Call OpenAI API to generate recipe details
  const fetchRecipeFromOpenAI = async (recipe) => {
    // if (!apiKey) {
    //   alert('Please enter your OpenAI API key first!');
    //   setShowApiKeyInput(true);
    //   return;
    // }

    // Check if we already have the details cached
    if (recipeDetails[recipe.id]) {
      setSelectedRecipe({ ...recipe, ...recipeDetails[recipe.id] });
      return;
    }

    setLoading(true);
    setSelectedRecipe(recipe);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer # add token'
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a professional chef. Generate detailed recipes in JSON format only. No extra text.'
            },
            {
              role: 'user',
              content: `Generate a detailed recipe for "${recipe.name}" (${recipe.description}). 
              Return ONLY a JSON object with this exact structure:
              {
                "ingredients": ["ingredient 1 with measurements", "ingredient 2 with measurements", ...],
                "instructions": ["step 1 with details", "step 2 with details", ...]
              }
              Make it detailed and professional. Include specific measurements and cooking temperatures where relevant.`
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the JSON response
      let recipeData;
      try {
        recipeData = JSON.parse(content);
      } catch (parseError) {
        // If response isn't pure JSON, try to extract JSON from text
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          recipeData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('Could not parse recipe data');
        }
      }

      // Cache the details
      setRecipeDetails(prev => ({
        ...prev,
        [recipe.id]: recipeData
      }));

      setSelectedRecipe({ ...recipe, ...recipeData });
    } catch (error) {
      console.error('Error fetching recipe from OpenAI:', error);
      alert(`Failed to generate recipe: ${error.message}\n\nPlease check your API key and try again.`);
      setSelectedRecipe(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50">
      {/* API Key Banner */}
     

      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500 rounded-lg">
                <ChefHat className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">AI Recipe Finder</h1>
                <p className="text-gray-600">Powered by OpenAI GPT - Get detailed recipes instantly</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Search and Filter */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-lg"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full font-medium transition ${
                  selectedCategory === category
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-6">
          <p className="text-gray-700 text-lg">
            Found <span className="font-bold text-orange-600">{filteredRecipes.length}</span> recipes
            {favorites.length > 0 && (
              <span className="ml-4 text-gray-600">
                • {favorites.length} favorite{favorites.length !== 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>

        {/* Recipe Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRecipes.map(recipe => (
            <div
              key={recipe.id}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition transform hover:-translate-y-1"
            >
              <div className="bg-gradient-to-br from-orange-400 to-red-400 h-40 flex items-center justify-center text-8xl">
                {recipe.image}
              </div>
              
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-800 mb-1">{recipe.name}</h3>
                    <p className="text-sm text-gray-600">{recipe.description}</p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(recipe.id)}
                    className="ml-2 p-2 rounded-full hover:bg-gray-100 transition"
                  >
                    <Heart
                      className={`w-6 h-6 ${
                        favorites.includes(recipe.id)
                          ? 'fill-red-500 text-red-500'
                          : 'text-gray-400'
                      }`}
                    />
                  </button>
                </div>

                <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {recipe.time}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    {recipe.servings}
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {recipe.rating}
                  </div>
                </div>

                <div className="mb-4">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    recipe.difficulty === 'Easy' 
                      ? 'bg-green-100 text-green-700'
                      : recipe.difficulty === 'Medium'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {recipe.difficulty}
                  </span>
                  <span className="ml-2 inline-block px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                    {recipe.category}
                  </span>
                </div>

                <button 
                  className="w-full mt-4 bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 rounded-xl font-semibold hover:from-orange-600 hover:to-red-600 transition flex items-center justify-center gap-2"
                  onClick={() => fetchRecipeFromOpenAI(recipe)}>
                  <Sparkles className="w-4 h-4" />
                  Generate with AI
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredRecipes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-xl">No recipes found. Try a different search!</p>
          </div>
        )}
      </div>

      {/* Recipe Modal with Loading State */}
      {selectedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
             onClick={() => !loading && setSelectedRecipe(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
               onClick={(e) => e.stopPropagation()}>
            
            {loading ? (
              <div className="p-12 text-center">
                <Loader className="w-16 h-16 text-orange-500 animate-spin mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-800 mb-2">Generating Recipe...</h3>
                <p className="text-gray-600">AI is creating a detailed recipe for {selectedRecipe.name}</p>
                <div className="mt-6 flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Sparkles className="w-4 h-4" />
                  <span>Powered by OpenAI GPT</span>
                </div>
              </div>
            ) : (
              <>
                <div className="sticky top-0 bg-gradient-to-br from-orange-400 to-red-400 p-6 flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-6xl">{selectedRecipe.image}</span>
                    <div className="text-white">
                      <h2 className="text-3xl font-bold mb-2">{selectedRecipe.name}</h2>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {selectedRecipe.time}
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="w-4 h-4" />
                          {selectedRecipe.servings} servings
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-white" />
                          {selectedRecipe.rating}
                        </div>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedRecipe(null)}
                    className="p-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition">
                    <X className="w-6 h-6 text-white" />
                  </button>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
                    <Sparkles className="w-4 h-4" />
                    <span>Generated by OpenAI</span>
                  </div>

                  <p className="text-gray-600 text-lg mb-6">{selectedRecipe.description}</p>

                  <div className="mb-6">
                    <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${
                      selectedRecipe.difficulty === 'Easy' 
                        ? 'bg-green-100 text-green-700'
                        : selectedRecipe.difficulty === 'Medium'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {selectedRecipe.difficulty}
                    </span>
                    <span className="ml-2 inline-block px-3 py-1 rounded-full text-sm font-semibold bg-orange-100 text-orange-700">
                      {selectedRecipe.category}
                    </span>
                  </div>

                  {selectedRecipe.ingredients && (
                    <div className="mb-8">
                      <h3 className="text-2xl font-bold text-gray-800 mb-4">Ingredients</h3>
                      <div className="bg-orange-50 rounded-xl p-4">
                        <ul className="space-y-2">
                          {selectedRecipe.ingredients.map((ingredient, idx) => (
                            <li key={idx} className="flex items-center gap-2 text-gray-700">
                              <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                              {ingredient}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {selectedRecipe.instructions && (
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-4">Instructions</h3>
                      <ol className="space-y-4">
                        {selectedRecipe.instructions.map((step, idx) => (
                          <li key={idx} className="flex gap-4">
                            <span className="flex-shrink-0 w-8 h-8 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            <p className="text-gray-700 pt-1">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  <button 
                    onClick={() => setSelectedRecipe(null)}
                    className="w-full mt-8 bg-orange-500 text-white py-3 rounded-xl font-semibold hover:bg-orange-600 transition">
                    Close Recipe
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}