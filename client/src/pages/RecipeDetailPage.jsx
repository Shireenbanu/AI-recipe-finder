import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../services/apiClient.js';

function RecipeDetailPage() {
  const navigate = useNavigate();
  const { recipeId } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    fetchRecipe();
  }, [recipeId]);

  const fetchRecipe = async () => {
    try {
      const response = await authFetch(`/api/recipes/${recipeId}?userId=${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setRecipe(data.recipe);
      }
    } catch (error) {
      console.error('Error fetching recipe:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setChatLoading(true);

    try {
      const response = await authFetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          recipeContext: {
            title: recipe.title,
            description: recipe.description,
            ingredients: recipe.ingredients,
            instructions: recipe.instructions
          }
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setMessages([...messages, userMessage, data.message]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading recipe...</div>;
  if (!recipe) return <div className="p-8">Recipe not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 1. Global Navigation Bar */}
      <nav className="bg-white shadow-sm border-b border-gray-200 mb-8">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <span className="mr-2">←</span> Back to Dashboard
          </button>
        </div>
      </nav>

      {/* 2. Main Content Container */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Recipe Details Section */}
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{recipe.title}</h1>
            <p className="text-gray-600 mb-6 leading-relaxed">{recipe.description}</p>

            <div className="flex gap-6 mb-8 text-sm font-medium text-gray-500 bg-gray-50 p-4 rounded-lg">
              <span className="flex items-center">⏱️ Prep: {recipe.prep_time}m</span>
              <span className="flex items-center">🔥 Cook: {recipe.cook_time}m</span>
              <span className="flex items-center">🍽️ Servings: {recipe.servings}</span>
            </div>

            <h2 className="text-xl font-semibold mb-4 text-gray-800">Ingredients</h2>
            <ul className="mb-8 space-y-3">
              {recipe.ingredients.map((ing, idx) => (
                <li key={idx} className="flex items-center text-gray-700">
                  <div className="w-2 h-2 bg-blue-400 rounded-full mr-3"></div>
                  <span>{ing.quantity} {ing.unit} {ing.item}</span>
                </li>
              ))}
            </ul>

            <h2 className="text-xl font-semibold mb-4 text-gray-800">Instructions</h2>
            <ol className="space-y-4">
              {recipe.instructions.map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-none w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-gray-700 leading-normal">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Chat Box Section */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col h-[700px] overflow-hidden">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                🍳 <span className="text-gray-800">Cooking Assistant</span>
              </h2>
            </div>
            
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
              {messages.length === 0 && (
                <div className="text-gray-400 text-center mt-20">
                  <div className="text-4xl mb-4">👩‍🍳</div>
                  <p>Ask me anything about cooking this recipe!</p>
                  <p className="text-sm mt-2">"Can I swap the butter for oil?"</p>
                </div>
              )}
              
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-none' 
                      : 'bg-gray-100 text-gray-800 rounded-tl-none border border-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-gray-50 border border-gray-100 p-4 rounded-2xl italic text-gray-500 flex items-center gap-2">
                    <span className="animate-pulse">●</span> 
                    Assistant is thinking...
                  </div>
                </div>
              )}
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-gray-50 border-t">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask a cooking question..."
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={chatLoading}
                />
                <button
                  type="submit"
                  disabled={chatLoading || !input.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
                >
                  Send
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

export default RecipeDetailPage;
