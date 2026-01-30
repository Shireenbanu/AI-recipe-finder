import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const fetchMedicalHistory = async () => {
    try {
      const conditionsRes = await fetch(`/api/users/${userId}/conditions`);
      const conditionsData = await conditionsRes.json();

      if (conditionsData.success) {
        setConditions(conditionsData.conditions);
      }

      const storedReports = JSON.parse(localStorage.getItem('labReports') || '[]');
      setLabReports(storedReports);

    } catch (error) {
      console.error('Error fetching medical history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (report) => {
    console.log(report)
  try {
    console.log('handle View Report')
    // 1. Ask your backend for a temporary VIP pass (Presigned URL)
    const res = await fetch(`/api/reports/presign?fileURL=${report.fileUrl}`);
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
      const response = await fetch('/api/reports/uploadLabReport', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      console.log('response received from fileupload', data)

      if (data.success) {
        const newReport = {
          fileName: data.file.fileName,
          fileUrl: data.file.fileUrl,
          uploadedAt: data.file.uploadedAt
        };

        const updatedReports = [...labReports, newReport];
        setLabReports(updatedReports);
        localStorage.setItem('labReports', JSON.stringify(updatedReports));

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

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-md">
        <div className="max-w-6xl mx-auto px-8 py-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-8 text-gray-800">Medical History</h1>

        {/* Medical Conditions Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border border-gray-100">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-semibold text-gray-700">Medical Conditions</h2>
            <button
              onClick={() => navigate('/conditions')}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Condition
            </button>
          </div>

          {conditions.length === 0 ? (
            <p className="text-gray-500 italic">No medical conditions added yet.</p>
          ) : (
            <div className="grid gap-4">
              {conditions.map((condition) => (
                <div
                  key={condition.condition_id}
                  className="border border-gray-200 rounded-lg p-4 flex justify-between items-start hover:border-blue-200 transition-colors"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{condition.condition_name}</h3>
                    <p className="text-gray-600 text-sm mb-3">{condition.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        Severity: {condition.severity}
                      </span>
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        Diagnosed: {new Date(condition.diagnosed_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveCondition(condition.condition_id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium ml-4"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Lab Reports Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-100">
          <h2 className="text-2xl font-semibold mb-6 text-gray-700">Lab Reports</h2>

          <div className="mb-8 p-4 border-2 border-dashed border-gray-200 rounded-xl text-center">
            <label className="cursor-pointer">
              <span className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 inline-block transition-colors">
                {uploadingFile ? 'Uploading...' : '+ Upload Lab Report'}
              </span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileUpload}
                disabled={uploadingFile}
                className="hidden"
              />
            </label>
            <p className="text-xs text-gray-400 mt-3">
              Accepted: PDF, JPG, PNG (Max 10MB)
            </p>
          </div>

          {labReports.length === 0 ? (
            <p className="text-gray-500 italic">No lab reports uploaded yet.</p>
          ) : (
            <div className="space-y-3">
              {labReports.map((report, idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 rounded-lg p-4 flex justify-between items-center hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      📄
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{report.fileName}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(report.uploadedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleViewReport(report)}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-200 font-medium transition-colors"
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MedicalHistoryPage;