import { useContext, createContext } from 'react';
import { YarrowAPI } from '@/lib/api/types';
import { api } from '@/lib/api';

const APIContext = createContext<YarrowAPI>(api);

export const APIProvider = APIContext.Provider;

export const useApi = (): YarrowAPI => {
  return useContext(APIContext);
};