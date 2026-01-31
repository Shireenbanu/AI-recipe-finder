import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signIn, getCurrentUser } from 'aws-amplify/auth';
import { signOut } from 'aws-amplify/auth';
import { authFetch } from '../../services/apiClient.js';

function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const startTime = Date.now()

  const handleSignIn = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {

      // 1. Check if the "saved" session is too old
      const lastActivity = localStorage.getItem('lastActivity');
      const twentyMinutes = 20 * 60 * 1000; // in milliseconds

      if (lastActivity && (Date.now() - parseInt(lastActivity)) > twentyMinutes) {
        // Session is stale, clear it before attempting login
        try { await signOut(); } catch (e) { console.log(e) }
        localStorage.clear();
      }
      // Sign in with Cognito
      await signIn({
        username: email,
        password: password
      });

      // Get current user info
      const currentUser = await getCurrentUser();

      // Fetch user from our database
      const response = await authFetch(`/api/users/email/${email}`);
      const data = await response.json();


      if (data.success) {
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name);
        localStorage.setItem('userEmail', data.user.email);
        console.info("✅ [AUTH_EVENT]: SIGN_IN_SUCCESS", {
          time: new Date().toISOString(),
          user_id: email,
          auth_provider: 'Cognito',
          session_start: Date.now()
        });
        navigate('/dashboard');
      } else {
        setError('User not found in database');
      }
    } catch (err) {
      setError(err.message || 'Sign in failed');
      console.warn("🔐 [SECURITY_EVENT]: SIGN_IN_FAILURE", {
      time: new Date().toISOString(),
      user_id: email,
      error_code: error.name, // e.g., 'NotAuthorizedException'
      message: error.message,
      attempt_duration_ms: Date.now() - startTime,
      client_info: {
        ua: navigator.userAgent,
        screen_resolution: `${window.screen.width}x${window.screen.height}`
      }
    })
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Sign In</h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSignIn}>
          <div className="mb-4">
            <label className="block text-gray-700 mb-2">Email</label>
            <input
              type="email"
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-2">Password</label>
            <input
              type="password"
              required
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 mb-4"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="w-full bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300"
          >
            Create New Account
          </button>
        </form>
      </div>
    </div>
  );
}

export default SignInPage;