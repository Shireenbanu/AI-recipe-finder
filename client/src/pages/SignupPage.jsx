import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signUp, confirmSignUp } from 'aws-amplify/auth';

function SignupPage() {
  const [step, setStep] = useState('signup'); // 'signup' or 'confirm'
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [confirmationCode, setConfirmationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignUp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signUp({
        username: formData.email,
        password: formData.password,
        options: {
          userAttributes: {
            email: formData.email,
            name: formData.name
          }
        }
      });

      setStep('confirm');
      alert('Check your email for verification code!');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await confirmSignUp({
        username: formData.email,
        confirmationCode: confirmationCode
      });

      // Create user in our database
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          cognitoId: formData.email // Use email as cognito identifier
        })
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('userId', data.user.id);
        localStorage.setItem('userName', data.user.name);
        navigate('/dashboard');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">
          {step === 'signup' ? 'Sign Up' : 'Verify Email'}
        </h1>
        
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {step === 'signup' ? (
          <form onSubmit={handleSignUp}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Name</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Email</label>
              <input
                type="email"
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.password}
                onChange={(e) => setFormData({...formData, password: e.target.value})}
              />
              <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="w-full mt-4 text-blue-600 hover:text-blue-700"
            >
              Already have an account? Sign In
            </button>
          </form>
        ) : (
          <form onSubmit={handleConfirm}>
            <p className="text-gray-600 mb-4">
              We sent a verification code to <strong>{formData.email}</strong>
            </p>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2">Verification Code</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirmationCode}
                onChange={(e) => setConfirmationCode(e.target.value)}
                placeholder="Enter 6-digit code"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {loading ? 'Verifying...' : 'Verify Email'}
            </button>

            <button
              type="button"
              onClick={() => setStep('signup')}
              className="w-full mt-4 text-gray-600 hover:text-gray-700"
            >
              ← Back to Sign Up
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default SignupPage;