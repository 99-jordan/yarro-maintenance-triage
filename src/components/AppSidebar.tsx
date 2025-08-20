import { useState, useEffect } from 'react';
import { Building2, Search, Plus, FileText, Settings, LogOut } from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import { useAuth } from '@/contexts/AuthContext';
import { Landlord } from '@/lib/api/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate, useLocation } from 'react-router-dom';

interface AppSidebarProps {
  selectedLandlordId?: string;
  onSelectLandlord: (landlordId: string) => void;
}

const AppSidebar = ({ selectedLandlordId, onSelectLandlord }: AppSidebarProps) => {
  const [landlords, setLandlords] = useState<Landlord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const api = useApi();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadLandlords();
  }, [search]);

  const loadLandlords = async () => {
    try {
      setLoading(true);
      const data = await api.listLandlords(search || undefined);
      setLandlords(data);
    } catch (error) {
      console.error('Error loading landlords:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const isImportRoute = location.pathname === '/app/import';
  const isSettingsRoute = location.pathname === '/app/settings';

  return (
    <div className="w-80 bg-card border-r border-border h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-2 mb-4">
          <div className="bg-primary text-primary-foreground w-8 h-8 rounded-lg flex items-center justify-center">
            <Building2 className="h-4 w-4" />
          </div>
          <span className="font-semibold">Yarrow</span>
        </div>
        
        {/* Navigation */}
        <div className="space-y-2">
          <Button
            variant={!isImportRoute && !isSettingsRoute ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate('/app')}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button
            variant={isImportRoute ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate('/app/import')}
          >
            <FileText className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button
            variant={isSettingsRoute ? "secondary" : "ghost"}
            className="w-full justify-start"
            onClick={() => navigate('/app/settings')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Search */}
      {!isImportRoute && !isSettingsRoute && (
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground transform -translate-y-1/2" />
            <Input
              className="pl-10"
              placeholder="Search landlords..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Landlords List */}
      {!isImportRoute && !isSettingsRoute && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              ))
            ) : landlords.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No landlords found</p>
                {search && (
                  <Button 
                    variant="link" 
                    onClick={() => setSearch('')}
                    className="text-xs"
                  >
                    Clear search
                  </Button>
                )}
              </div>
            ) : (
              landlords.map((landlord) => (
                <div
                  key={landlord.id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors ${
                    selectedLandlordId === landlord.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-accent'
                  }`}
                  onClick={() => onSelectLandlord(landlord.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{landlord.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      2
                    </Badge>
                  </div>
                  <div className="text-xs opacity-75">
                    {landlord.email}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start text-destructive hover:text-destructive"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default AppSidebar;