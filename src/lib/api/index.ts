import { YarrowAPI } from './types';
import { supabaseAdapter } from './supabaseAdapter';

// API provider - using Supabase only
export const createAPI = (): YarrowAPI => {
  return supabaseAdapter;
};

// Default API instance - using Supabase
export const api = createAPI();

// Export api as default for compatibility
export default api;