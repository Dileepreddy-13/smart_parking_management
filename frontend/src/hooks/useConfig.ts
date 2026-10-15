import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

export const useConfig = () => useQuery({ queryKey: ['config'], queryFn: api.config, staleTime: Infinity });
