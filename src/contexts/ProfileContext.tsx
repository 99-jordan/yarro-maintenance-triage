import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Profile, Agency } from '@/lib/api/types';
import { useAuth } from './AuthContext';
import { useApi } from '@/hooks/useApi';

interface ProfileContextType {
  profile: Profile | null;
  agency: Agency | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [agency, setAgency] = useState<Agency | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const api = useApi();

  const fetchProfileAndAgency = async () => {
    if (!session) {
      setProfile(null);
      setAgency(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Fetch user profile
      const profileData = await api.getProfile();
      setProfile(profileData);
      
      // Fetch agency data if profile exists
      if (profileData?.agencyId) {
        try {
          // Use RPC to get agency details
          const { data: agencyData, error } = await (api as any).supabase
            .rpc('get_user_agency')
            .single();
            
          if (error) {
            console.error('Error fetching agency:', error);
          } else {
            setAgency(agencyData);
          }
        } catch (err) {
          console.error('Error fetching agency:', err);
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
      setAgency(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileAndAgency();
  }, [session]);

  const refreshProfile = async () => {
    await fetchProfileAndAgency();
  };

  return (
    <ProfileContext.Provider value={{ 
      profile, 
      agency, 
      loading, 
      refreshProfile 
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
