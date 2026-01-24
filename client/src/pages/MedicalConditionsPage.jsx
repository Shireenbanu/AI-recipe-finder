import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function MedicalConditionsPage() {
  const navigate = useNavigate();
  const [conditions, setConditions] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('userId');
  const [uploading, setUploading] = useState(false);
  const [fileUrl, setFileUrl] = useState('');
  useEffect(() => {
    fetchConditions();
  }, []);

  const fetchConditions = async () => {
    try {
      const response = await fetch('/api/medical-conditions');
      const data = await response.json();
      if (data.success) {
        setConditions(data.conditions);
      }
    } catch (error) {
      console.error('Error fetching conditions:', error);
    } finally {
      setLoading(false);
    }
  };

  

   const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    try {
      // This calls your backend route which uses the uploadFile function we wrote
      const response = await fetch('/api/upload-lab-report', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setFileUrl(data.fileUrl);
        alert('Lab report uploaded successfully!');
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload lab report');
    } finally {
      setUploading(false);
    }
}

  const handleAddCondition = async (conditionId) => {
    try {
      const response = await fetch(`/api/users/${userId}/conditions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conditionId,
          severity: 'moderate'
        })
      });

      const data = await response.json();
      if (data.success) {
        setSelectedConditions([...selectedConditions, conditionId]);
        alert('Condition added!');
      }
    } catch (error) {
      console.error('Error adding condition:', error);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (


    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">

        <div className="bg-white p-6 rounded-lg shadow-md mb-8 border-2 border-dashed border-blue-300">
          <h2 className="text-xl font-bold mb-4">Upload Lab Report (Optional)</h2>
          <p className="text-gray-600 mb-4">Upload your latest blood work for better accuracy.</p>
          
          <input 
            type="file" 
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          
          {uploading && <p className="mt-2 text-blue-600">Uploading to S3...</p>}
          {fileUrl && <p className="mt-2 text-green-600">✓ Report attached: {fileUrl.split('/').pop()}</p>}
        </div>

        <h1 className="text-3xl font-bold mb-2">Select Your Medical Conditions</h1>
        <p className="text-gray-600 mb-8">We'll recommend recipes based on your needs</p>

        <div className="grid gap-4">
          {conditions.map((condition) => {
            const isSelected = selectedConditions.includes(condition.id);
            
            return (
              <div
                key={condition.id}
                className={`bg-white p-6 rounded-lg shadow-md border-2 ${
                  isSelected ? 'border-green-500' : 'border-gray-200'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{condition.name}</h3>
                    <p className="text-gray-600 mb-3">{condition.description}</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(condition.recommended_nutrients).map(([nutrient, level]) => (
                        <span
                          key={nutrient}
                          className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                        >
                          {nutrient}: {level}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleAddCondition(condition.id)}
                    disabled={isSelected}
                    className={`ml-4 px-6 py-2 rounded-lg ${
                      isSelected
                        ? 'bg-green-500 text-white cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isSelected ? '✓ Added' : 'Add'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {selectedConditions.length > 0 && (
          <button
            onClick={() => navigate('/recipes')}
            className="mt-8 w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700"
          >
            Continue to Recipes ({selectedConditions.length} condition{selectedConditions.length > 1 ? 's' : ''} selected)
          </button>
        )}
      </div>
    </div>
 
  );
 }

export default MedicalConditionsPage;