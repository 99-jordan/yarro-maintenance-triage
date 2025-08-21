import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Profile, Agency } from '@/lib/api/types';
import { useAuth } from './AuthContext';
import { useApi } from '@/hooks/useApi';
import { supabase } from '@/lib/api/supabaseAdapter';

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
          // Prefer RPC if available; otherwise fallback to direct table query
          const { data: rpcData, error: rpcError } = await supabase
            .rpc('get_user_agency')
            .single();

          if (rpcError) {
            // Fallback: query agencies table by ID from profile
            const { data: agencyRow, error: agencyError } = await supabase
              .from('agencies')
              .select('*')
              .eq('id', profileData.agencyId)
              .single();

            if (agencyError) {
              console.error('Error fetching agency:', agencyError);
            } else {
              setAgency({
                id: agencyRow.id,
                name: agencyRow.name,
                slug: agencyRow.slug,
                settings: agencyRow.settings,
                createdAt: agencyRow.created_at,
                updatedAt: agencyRow.updated_at,
              });
            }
          } else if (rpcData) {
            setAgency({
              id: rpcData.id,
              name: rpcData.name,
              slug: rpcData.slug,
              settings: rpcData.settings,
              createdAt: rpcData.created_at,
              updatedAt: rpcData.updated_at,
            });
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
