import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../services/apiClient.js';

function ProfilePage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      navigate('/signin');
      return;
    }
    fetchProfile();
  }, [userId, navigate]);

  const fetchProfile = async () => {
    try {
      const response = await authFetch(`/api/users/${userId}`);
      const data = await response.json();
      
      if (data.success) {
        setProfile(data.user);
        setFormData({
          name: data.user.name,
          email: data.user.email
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const response = await authFetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();
      
      if (data.success) {
        setProfile(data.user);
        localStorage.setItem('userName', data.user.name);
        setEditing(false);
        alert('Profile updated!');
      }
    } catch (error) {
      alert('Failed to update profile');
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-md">
        <div className="max-w-4xl mx-auto px-8 py-4 flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-700"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-8">My Profile</h1>

        <div className="bg-white rounded-lg shadow-md p-8">
          {!editing ? (
            // View Mode
            <div>
              <div className="mb-6">
                <label className="block text-gray-600 text-sm mb-1">Name</label>
                <p className="text-xl font-semibold">{profile?.name}</p>
              </div>

              <div className="mb-6">
                <label className="block text-gray-600 text-sm mb-1">Email</label>
                <p className="text-xl">{profile?.email}</p>
              </div>

              <div className="mb-6">
                <label className="block text-gray-600 text-sm mb-1">Member Since</label>
                <p className="text-gray-700">
                  {new Date(profile?.created_at).toLocaleDateString()}
                </p>
              </div>

              <button
                onClick={() => setEditing(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Edit Profile
              </button>
            </div>
          ) : (
            // Edit Mode
            <form onSubmit={handleUpdate}>
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

              <div className="mb-6">
                <label className="block text-gray-700 mb-2">Email</label>
                <input
                  type="email"
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setFormData({
                      name: profile.name,
                      email: profile.email
                    });
                  }}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;