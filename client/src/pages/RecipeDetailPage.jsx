import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

function RecipeDetailPage() {
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
      const response = await fetch(`/api/recipes/${recipeId}?userId=${userId}`);
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
      const response = await fetch('/api/chat', {
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
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">
        
        {/* Recipe Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold mb-4">{recipe.title}</h1>
          <p className="text-gray-600 mb-6">{recipe.description}</p>

          <div className="flex gap-4 mb-6 text-sm">
            <span>⏱️ Prep: {recipe.prep_time}m</span>
            <span>🔥 Cook: {recipe.cook_time}m</span>
            <span>🍽️ Servings: {recipe.servings}</span>
          </div>

          <h2 className="text-xl font-semibold mb-3">Ingredients</h2>
          <ul className="mb-6 space-y-2">
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx} className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>{ing.quantity} {ing.unit} {ing.item}</span>
              </li>
            ))}
          </ul>

          <h2 className="text-xl font-semibold mb-3">Instructions</h2>
          <ol className="space-y-3">
            {recipe.instructions.map((step, idx) => (
              <li key={idx} className="flex">
                <span className="font-semibold text-blue-600 mr-3">{idx + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Chat Box */}
        <div className="bg-white rounded-lg shadow-md p-6 flex flex-col h-[600px]">
          <h2 className="text-xl font-semibold mb-4">🍳 Cooking Assistant</h2>
          
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-gray-400 text-center mt-8">
                Ask me anything about cooking this recipe!
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 p-3 rounded-lg">
                  Thinking...
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a cooking question..."
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={chatLoading}
            />
            <button
              type="submit"
              disabled={chatLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default RecipeDetailPage;
