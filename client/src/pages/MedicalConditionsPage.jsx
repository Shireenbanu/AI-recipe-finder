import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../../services/apiClient.js';

function MedicalConditionsPage() {
  const navigate = useNavigate();
  const [conditions, setConditions] = useState([]);
  const [selectedConditions, setSelectedConditions] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const userId = localStorage.getItem('userId');

  useEffect(() => {
    fetchConditions();
  }, []);

  const fetchConditions = async () => {
  try {
    setLoading(true);

    // 1. Fetch all possible conditions
    const response = await authFetch('/api/medical-conditions');
    const data = await response.json();

    // 2. Fetch the specific user's existing conditions
    // Assuming fetchConditionforUser returns the array of user conditions
    const userConditions = await fetchConditionforUser(); 

    if (data.success && userConditions) {
      // 3. Create a Set of IDs the user ALREADY has for O(1) lookup
      const existingConditionIds = new Set(
        userConditions.map(uc => uc.conditionId)
      );

      // 4. Filter the main list: keep only if 'id' is NOT in the Set
      const unassignedConditions = data.conditions.filter(
        condition => !existingConditionIds.has(condition.id)
      );

      setConditions(unassignedConditions);
      console.log('Filtered Conditions (Available to add):', unassignedConditions);
    }
  } catch (error) {
    console.error('Error fetching conditions:', error);
  } finally {
    setLoading(false);
  }
};

  const fetchConditionforUser = async() => {
  try {
      const response = await authFetch(`/api/users/${userId}/nutritional-needs`);
      const data = await response.json();
      console.log('interface per conditons', data.conditions)
      if (data.success) {
      return data.conditions
      }
    } catch (error) {
      console.error('Error fetching conditions for user:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleAddCondition = async (conditionId) => {
    try {
      const response = await authFetch(`/api/users/${userId}/conditions`, {
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
      }
    } catch (error) {
      console.error('Error adding condition:', error);
    }
  };

  // Filter conditions based on search
  const filteredConditions = conditions.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-12 text-center text-slate-500 font-medium">Loading conditions...</div>;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation Header */}
      <nav className="bg-white border-b sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <button onClick={() => navigate('/medical-history')} className="text-slate-500 hover:text-slate-800 flex items-center gap-2">
            <span>←</span> Back
          </button>
          
          <div className="flex gap-4">
            {selectedConditions.length > 0 && (
              <button
                onClick={() => navigate('/recipes')}
                className="bg-orange-500 text-white px-6 py-2 rounded-full font-bold shadow-lg hover:bg-orange-600 transition-all flex items-center gap-2"
              >
                🍳 View My Recipes
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-3">What are your health goals?</h1>
          <p className="text-lg text-slate-600">Select conditions to tailor your AI-generated meal plans.</p>
        </div>

        {/* Search Bar */}
        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Search conditions (e.g., Diabetes, Hypertension)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          />
          <span className="absolute left-4 top-4 text-2xl">🔍</span>
        </div>

        {/* Conditions Grid */}
        <div className="grid gap-6">
          {filteredConditions.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
              <p className="text-slate-400">No conditions found matching your search.</p>
            </div>
          ) : (
            filteredConditions.map((condition) => {
              const isSelected = selectedConditions.includes(condition.id);
              
              return (
                <div
                  key={condition.id}
                  className={`group relative bg-white p-6 rounded-2xl transition-all duration-300 ${
                    isSelected 
                      ? 'ring-2 ring-blue-500 shadow-blue-50 shadow-md' 
                      : 'border border-slate-200 hover:border-blue-300 hover:shadow-lg'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-slate-800">{condition.name}</h3>
                        {isSelected && <span className="text-blue-600 text-sm font-bold bg-blue-50 px-2 py-0.5 rounded">Selected</span>}
                      </div>
                      <p className="text-slate-600 text-sm leading-relaxed mb-4">{condition.description}</p>
                      
                      <div className="flex gap-2 flex-wrap">
                        {Object.entries(condition.recommended_nutrients).map(([nutrient, level]) => (
                          <span
                            key={nutrient}
                            className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold uppercase tracking-tight"
                          >
                            {nutrient}: {level}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleAddCondition(condition.id)}
                      disabled={isSelected}
                      className={`ml-6 flex-none w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-blue-600 text-white scale-110 shadow-lg'
                          : 'bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-200'
                      }`}
                    >
                      {isSelected ? (
                        <span className="text-2xl font-bold">✓</span>
                      ) : (
                        <span className="text-2xl font-light">+</span>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Continue Bar (Mobile/Table Friendly) */}
      {selectedConditions.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-lg bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between z-30 animate-in fade-in slide-in-from-bottom-4">
          <div className="pl-4">
            <p className="text-xs text-slate-400 uppercase font-bold tracking-widest">Selected</p>
            <p className="text-lg font-bold">{selectedConditions.length} Condition{selectedConditions.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => navigate('/recipes')}
            className="bg-blue-500 hover:bg-blue-400 text-white px-8 py-3 rounded-2xl font-bold transition-colors"
          >
            Show Recipes
          </button>
        </div>
      )}
    </div>
  );
}

export default MedicalConditionsPage;