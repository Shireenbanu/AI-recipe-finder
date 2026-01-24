import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';

import SignInPage from './pages/SignInPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import MedicalHistoryPage from './pages/MedicalHistoryPage';
import MedicalConditionsPage from './pages/MedicalConditionsPage';
import RecipesPage from './pages/RecipesPage';
import RecipeDetailPage from './pages/RecipeDetailPage';

function App() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      await getCurrentUser();
      // User is authenticated with Cognito
      const userId = localStorage.getItem('userId');
      if (userId) {
        setIsAuthenticated(true);
      }
    } catch (error) {
      // User is not authenticated
      setIsAuthenticated(false);
      localStorage.clear();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Navigate to="/signin" />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/medical-history" element={<MedicalHistoryPage />} />
        <Route path="/conditions" element={<MedicalConditionsPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;