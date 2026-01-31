import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../services/apiClient.js';

function MedicalHistoryPage() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [conditions, setConditions] = useState([]);
  const [labReports, setLabReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate('/signin');
      return;
    }
    fetchMedicalHistory();
  }, [userId, navigate]);

  const fetchLabReports = async () => {
    try {
      const res = await authFetch(`/api/users/lab_reports/${userId}`);
      const data = await res.json();
      
      if (data.success) {
 
        setLabReports(data.files || []); 
      }
    } catch (error) {
      console.error('Error fetching lab reports:', error);
    }
  }

  const fetchMedicalHistory = async () => {
    try {
      const conditionsRes = await authFetch(`/api/users/${userId}/conditions`);
      const conditionsData = await conditionsRes.json();

      if (conditionsData.success) {
        setConditions(conditionsData.conditions);
      }
      await fetchLabReports()

    } catch (error) {
      console.error('Error fetching medical history:', error);
    } finally {
      setLoading(false);
    }
  };

      
    

  const handleViewReport = async (report) => {
    console.log(report)
  try {
    const res = await authFetch(`/api/reports/presign?fileURL=${report}`);
    const data = await res.json();

    if (data.success) {
      // 2. Open the temporary link in a new tab
      window.open(data.s3Url, '_blank');
    } else {
      alert("Could not generate access link");
    }
  } catch (error) {
    console.error("Error fetching signed URL:", error);
  }
};


  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingFile(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    try {
      const response = await authFetch('/api/reports/uploadLabReport', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      console.log('response received from fileupload', data)

      if (data.success) {
       await fetchLabReports()

        alert('Lab report uploaded successfully!');
        e.target.value = '';
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (error) {
      alert('Upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  const handleRemoveCondition = async (conditionId) => {
    if (!confirm('Remove this condition?')) return;

    try {
      const response = await fetch(`/api/users/${userId}/conditions/${conditionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setConditions(conditions.filter(c => c.condition_id !== conditionId));
        alert('Condition removed');
      }
    } catch (error) {
      alert('Failed to remove condition');
    }
  };

    const handleGenerateRecipes = async (conditionId) => {
    if (!confirm('Remove this condition?')) return;

    try {
      const response = await fetch(`/api/users/${userId}/conditions/${conditionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setConditions(conditions.filter(c => c.condition_id !== conditionId));
        alert('Condition removed');
      }
    } catch (error) {
      alert('Failed to remove condition');
    }
  };


if (loading) return <div className="p-8 text-center animate-pulse text-gray-500">Loading your health profile...</div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Navigation */}
      <nav className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/dashboard')} className="text-slate-600 hover:text-blue-600 flex items-center gap-2 transition-all">
            <span>←</span> <span className="font-medium">Dashboard</span>
          </button>
          
          {/* Main Action Button - Accessible anywhere on the page */}
          <button 
            onClick={() => navigate('/recipes')}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-full font-bold shadow-lg shadow-orange-200 transition-all transform hover:scale-105 active:scale-95 flex items-center gap-2"
          >
            🍳 Generate AI Recipes
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">Medical History</h1>
          <p className="text-slate-500 mt-2">Manage your conditions and reports to personalize your meal plans.</p>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Left Column: Conditions (Takes up more space) */}
          <div className="lg:col-span-2 space-y-8">
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-800">Medical Conditions</h2>
                <button onClick={() => navigate('/conditions')} className="text-sm bg-blue-50 text-blue-600 px-4 py-2 rounded-lg font-semibold hover:bg-blue-100 transition-colors">
                  + Add New
                </button>
              </div>
              
              <div className="p-6">
                {conditions.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-slate-400 italic">No conditions recorded.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {conditions.map((condition) => (
                      <div key={condition.condition_id} className="group border border-slate-100 rounded-xl p-5 hover:border-blue-300 hover:bg-blue-50/30 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-lg font-bold text-slate-800">{condition.condition_name}</h3>
                            <p className="text-slate-600 text-sm mt-1">{condition.description}</p>
                          </div>
                          <button onClick={() => handleRemoveCondition(condition.condition_id)} className="text-slate-300 hover:text-red-500 transition-colors">
                            ✕
                          </button>
                        </div>
                        <div className="mt-4 flex gap-3">
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded">
                            {condition.severity}
                          </span>
                          <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded">
                            {new Date(condition.diagnosed_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Lab Reports & Quick Actions */}
          <div className="space-y-8">
            
            {/* Upload Section */}
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Lab Reports</h2>
              
              <div className={`relative group border-2 border-dashed rounded-xl p-6 text-center transition-all ${uploadingFile ? 'bg-slate-50 border-slate-200' : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'}`}>
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploadingFile} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <div className="space-y-2">
                  <div className="text-3xl">{uploadingFile ? '⏳' : '📁'}</div>
                  <p className="text-sm font-medium text-slate-700">{uploadingFile ? 'Uploading...' : 'Click to upload report'}</p>
                  <p className="text-xs text-slate-400">PDF, JPG, PNG (Max 10MB)</p>
                </div>
              </div>

              <div className="mt-6 space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {labReports.map((report, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {report.split('/').pop().replace(/^\d+-/, '')}
                      </p>
                    </div>
                    <button onClick={() => handleViewReport(report)} className="ml-3 text-xs font-bold text-blue-600 hover:text-blue-800 underline">
                      View
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {/* Health Tip / Info Card */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-xl shadow-blue-200">
              <h3 className="font-bold text-lg mb-2">Recipe Ready?</h3>
              <p className="text-blue-100 text-sm mb-4">
                We use your {conditions.length} conditions and {labReports.length} reports to curate a diet that's right for you.
              </p>
              <button onClick={() => navigate('/recipes')} className="w-full py-3 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition-colors">
                Start Meal Planning
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default MedicalHistoryPage;