import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import SignInPage from './pages/SignInPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import MedicalConditionsPage from './pages/MedicalConditionsPage';
import RecipesPage from './pages/RecipesPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import ProfilePage from './pages/ProfilePage';
import MedicalHistoryPage from './pages/MedicalHistoryPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/signin" />} />
        <Route path="/signin" element={<SignInPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/conditions" element={<MedicalConditionsPage />} />
        <Route path="/recipes" element={<RecipesPage />} />
        <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/medical-history" element={<MedicalHistoryPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;


