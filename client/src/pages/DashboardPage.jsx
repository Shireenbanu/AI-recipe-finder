import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';

function DashboardPage() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('');
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (!userId) {
      navigate('/signin');
    }
    setUserName(localStorage.getItem('userName') || 'User');
  }, [userId, navigate]);

  const handleSignOut = () => {
    localStorage.clear();
    navigate('/signin');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Recipe Finder</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Hello, {userName}</span>
            <button
              onClick={handleSignOut}
              className="text-red-600 hover:text-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Main Menu */}
      <div className="max-w-6xl mx-auto px-8 py-12">
        <h2 className="text-3xl font-bold mb-8">What would you like to do?</h2>
        
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Profile */}
          <button
            onClick={() => navigate('/profile')}
            className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition text-left"
          >
            <div className="text-4xl mb-4">👤</div>
            <h3 className="text-xl font-semibold mb-2">My Profile</h3>
            <p className="text-gray-600">View and edit your profile information</p>
          </button>

          {/* Medical History */}
          <button
            onClick={() => navigate('/medical-history')}
            className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition text-left"
          >
            <div className="text-4xl mb-4">🏥</div>
            <h3 className="text-xl font-semibold mb-2">Medical History</h3>
            <p className="text-gray-600">Lab reports & medical conditions</p>
          </button>

          {/* Browse Recipes */}
          <button
            onClick={() => navigate('/recipes')}
            className="bg-white p-8 rounded-lg shadow-md hover:shadow-lg transition text-left"
          >
            <div className="text-4xl mb-4">🍳</div>
            <h3 className="text-xl font-semibold mb-2">Healthy Recipes</h3>
            <p className="text-gray-600">Browse recommended recipes</p>
          </button>

        </div>
      </div>
    </div>
  );
}

export default DashboardPage;