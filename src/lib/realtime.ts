// Import the existing Supabase client to avoid multiple instances
import { supabase } from '@/lib/api/supabaseAdapter';

export const subscribeToPropertyFeed = (propertyId: string, callback: () => void) => {
  const channel = supabase
    .channel(`property-feed-${propertyId}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'updates', 
      filter: `property_id=eq.${propertyId}` 
    }, callback)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'tenant_tickets', 
      filter: `property_id=eq.${propertyId}` 
    }, callback)
    .subscribe();

  return () => supabase.removeChannel(channel);
};
