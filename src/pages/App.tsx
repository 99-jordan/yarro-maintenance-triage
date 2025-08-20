import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import AgentDashboard from '@/components/AgentDashboard';
import { useApi } from '@/hooks/useApi';
import { Property } from '@/lib/api/types';

const App = () => {
  const [selectedLandlordId, setSelectedLandlordId] = useState<string>('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(false);
  const api = useApi();
  const location = useLocation();

  const isDashboard = location.pathname === '/app' || location.pathname === '/app/';

  useEffect(() => {
    if (selectedLandlordId && isDashboard) {
      loadProperties();
    }
  }, [selectedLandlordId, isDashboard]);

  const loadProperties = async () => {
    if (!selectedLandlordId) return;
    
    try {
      setLoading(true);
      const data = await api.listProperties(selectedLandlordId);
      setProperties(data);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <AppSidebar
        selectedLandlordId={selectedLandlordId}
        onSelectLandlord={setSelectedLandlordId}
      />
      <div className="flex-1 overflow-hidden">
        {isDashboard ? (
          <AgentDashboard
            selectedLandlordId={selectedLandlordId}
          />
        ) : (
          <Outlet />
        )}
      </div>
    </div>
  );
};

export default App;