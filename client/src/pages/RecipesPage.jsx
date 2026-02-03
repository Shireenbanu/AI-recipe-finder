import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../services/apiClient.js';

function RecipesPage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate('/signin');
      return;
    }
    fetchRecommendations();
  }, [userId, navigate]);

  const fetchRecommendations = async () => {
    try {
      const response = await authFetch(`/api/recipes/recommendations?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setRecipes(data.recommendations);
      }
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchLoading(true);
    try {
      const response = await authFetch(`/api/recipes/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (data.success) {
        setRecipes(data.recipes);
      }
    } catch (error) {
      console.error('Error searching recipes:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    setLoading(true);
    fetchRecommendations();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-2">🍳 Loading recipes...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-2">Healthy Recipes</h1>
        <p className="text-gray-600 mb-8">
          {searchQuery ? 'Search results' : 'Recommended for you based on your health needs'}
        </p>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="mb-8">
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Search recipes by name, ingredient, or cuisine..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={handleReset}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300"
              >
                Reset
              </button>
            )}
          </div>
        </form>

        {/* Results */}
        {recipes.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-xl text-gray-500">No recipes found</p>
            <p className="text-gray-400 mt-2">Try a different search term</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map((recipe) => (
              <div key={recipe.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                <div className="p-6">
                  <h3 className="text-xl font-semibold mb-2">{recipe.title}</h3>
                  <p className="text-gray-600 text-sm mb-4">{recipe.description}</p>
                  
                  <div className="flex gap-4 text-sm text-gray-500 mb-4">
                    <span>⏱️ {recipe.prep_time + recipe.cook_time} min</span>
                    <span>🍽️ {recipe.servings} servings</span>
                    <span>📊 {recipe.difficulty}</span>
                  </div>

                  {/* <div className="flex flex-wrap gap-2 mb-4">
                    {recipe.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                        {tag}
                      </span>
                    ))}
                  </div> */}

                  <button
                    onClick={() => navigate(`/recipes/${recipe.id}`)}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700"
                  >
                    View Recipe
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecipesPage;